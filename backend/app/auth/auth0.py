from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
import requests
from functools import lru_cache
import os
import logging
import json
from typing import Optional, Dict, Union, List
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import base64

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

security = HTTPBearer()

@lru_cache()
def get_auth0_public_key():
    """
    Fetch and cache the Auth0 public key for token verification.
    """
    domain = os.getenv("AUTH0_DOMAIN")
    url = f"https://{domain}/.well-known/jwks.json"
    logger.debug(f"Fetching public key from: {url}")
    response = requests.get(url)
    return response.json()

def get_signing_key(token: str) -> Optional[str]:
    """Get the signing key used to sign the token."""
    try:
        jwks = get_auth0_public_key()
        unverified_header = jwt.get_unverified_header(token)
        logger.debug(f"Token header: {json.dumps(unverified_header, indent=2)}")
        logger.debug(f"Available keys: {[key['kid'] for key in jwks['keys']]}")
        
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                logger.debug(f"Found matching key with kid: {key['kid']}")
                # Convert RSA key components to PEM format
                numbers = RSAPublicNumbers(
                    e=int.from_bytes(base64.urlsafe_b64decode(key['e'] + '==='), byteorder='big'),
                    n=int.from_bytes(base64.urlsafe_b64decode(key['n'] + '==='), byteorder='big')
                )
                public_key = numbers.public_key(backend=default_backend())
                pem = public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                )
                return pem.decode('utf-8')
        logger.error(f"No key found matching kid: {unverified_header['kid']}")
        return None
    except Exception as e:
        logger.error(f"Error getting signing key: {str(e)}")
        return None

async def verify_auth0_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify Auth0 token and return payload if valid."""
    try:
        token = credentials.credentials
        logger.debug("Starting token verification")
        
        # Get the signing key
        signing_key = get_signing_key(token)
        if not signing_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate key to verify token"
            )
        
        # Get expected values
        expected_issuer = f"https://{os.getenv('AUTH0_DOMAIN')}/"
        expected_audience = os.getenv("AUTH0_AUDIENCE")
        
        # First decode without verification to check the audience
        try:
            unverified_payload = jwt.decode(
                token,
                signing_key,
                algorithms=[os.getenv("AUTH0_ALGORITHMS", "RS256")],
                options={
                    "verify_signature": True,
                    "verify_aud": False,
                    "verify_iss": False
                }
            )
            
            # Get token audience(s)
            token_audience = unverified_payload.get('aud', [])
            if isinstance(token_audience, str):
                token_audience = [token_audience]
            
            # Check if our expected audience is in the token's audience list
            if expected_audience not in token_audience:
                logger.error(f"Invalid audience. Expected {expected_audience}, got {token_audience}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid audience"
                )
            
            # Now verify everything else
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=[os.getenv("AUTH0_ALGORITHMS", "RS256")],
                issuer=expected_issuer,
                options={
                    "verify_aud": False  # We already verified the audience
                }
            )
            
            logger.debug(f"Token successfully decoded. Payload: {json.dumps(payload, indent=2)}")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.error("Token has expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except Exception as e:
            logger.error(f"Error decoding token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(e)
            )
            
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}"
        )

def get_user_id(token_payload: dict = Depends(verify_auth0_token)) -> str:
    """
    Extract the user ID from the Auth0 token payload.
    """
    return token_payload.get("sub") 