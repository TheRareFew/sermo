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

def get_token_audience() -> Union[str, List[str]]:
    """
    Get the expected audience(s) from environment variable.
    Returns a list of audiences or a single audience string.
    """
    audience = os.getenv("AUTH0_AUDIENCE")
    logger.debug(f"Raw audience from env: {audience}")
    
    if not audience:
        return []
    
    # If the audience contains commas, treat it as a list
    if ',' in audience:
        audiences = [aud.strip() for aud in audience.split(',')]
        logger.debug(f"Multiple audiences: {audiences}")
        return audiences
    
    logger.debug(f"Single audience: {audience}")
    return audience

async def verify_auth0_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verify the Auth0 JWT token and return the payload if valid.
    """
    try:
        token = credentials.credentials
        logger.debug("Starting token verification")
        
        # Get the signing key
        public_key = get_signing_key(token)
        if not public_key:
            logger.error("No matching signing key found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token - no matching signing key"
            )
            
        logger.debug("Attempting to decode token")
        
        # Get issuer from env
        issuer = f"https://{os.getenv('AUTH0_DOMAIN')}/"
        audience = get_token_audience()
        logger.debug(f"Expected issuer: {issuer}")
        logger.debug(f"Expected audience: {audience}")
        
        # Decode and verify the token
        try:
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=audience,
                issuer=issuer,
                options={
                    "verify_at_hash": False,
                }
            )
            logger.debug(f"Token successfully decoded. Payload: {json.dumps(payload, indent=2)}")
            return payload
            
        except JWTError as decode_error:
            logger.error(f"Error decoding token: {str(decode_error)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {str(decode_error)}"
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