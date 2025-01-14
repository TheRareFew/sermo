# Plan of Action: Implement Voice Channels with Opus Streaming over WebSockets

Below is a detailed plan to help you implement the new voice channel feature in our application. The plan is divided into incremental steps and uses checkboxes to keep track of progress. This plan assumes knowledge of our existing codebase structure (primarily in the backend folder and the eventual frontend integration). Throughout the steps, you will find references to files and directories we may need to modify or create.

---

## 1. Analysis of Existing Codebase

- [ ] Inspect existing WebSocket-related code (if any):
  - Check if we already have a WebSocket server implementation under "backend/websockets" or similar directory. 
  - If no existing code is handling real-time audio streaming, plan to create a new file in "backend/voice_server.py" or incorporate it into an existing WebSocket server file.

- [ ] Evaluate logging and debugging approach:
  - Identify where logs are configured and ensure we can add new logs for debugging audio stream issues.

- [ ] Determine integration points for speech-to-text (STT):
  - If we have an STT pipeline, see if it’s located in "backend/speech_to_text.py" or similar. 
  - If we need a new pipeline for STT, plan out how audio frames will be passed to it.

- [ ] Confirm code references in "docs/todo.txt":
  - The note in "docs/todo.txt" states we need to implement a simple voice channel for looping the user’s voice back. 
  - The note also specifies using Opus, so confirm we have the necessary libraries installed or add them to the relevant "requirements.txt" or "requirements.dev.txt" file if needed.

---

## 2. File References and Proposed Additions

We will likely create or modify the following files:

1. "backend/voice_server.py"  
   - Handles the new WebSocket endpoint for audio streaming.  
   - Encodes and decodes audio using Opus.  
   - Streams audio data to/from clients.  
   
2. "backend/speech_to_text_integration.py"  
   - If a separate integration file is needed, route audio frames through our STT model here.  

3. "frontend/js/voiceClient.js" or "frontend/js/voice_client.ts"  
   - Handles client-side WebSocket connections to the new endpoint.  
   - Captures user microphone audio, sends to server, receives loopback audio, and plays it.  

4. "docs/todo.txt"  
   - Update it once the feature is implemented.  

---

## 3. Detailed Technical Steps

### A. Backend WebSocket Service

- [ ] Create "backend/voice_server.py" (if it does not exist yet).
  - Define a WebSocket route (for example, "/ws/voice").
  - Use a framework like FastAPI, Starlette, or asyncio websockets to manage connections.

[CODE START - Sample WebSocket Setup in Python]
import asyncio
import websockets

async def voice_handler(websocket, path):
    # handle the audio streaming here, encode/decode with opus
    # loop back audio to the sender for now

start_server = websockets.serve(voice_handler, "0.0.0.0", 8000)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
[CODE END]

- [ ] Implement Opus encoding/decoding (consider using a library like py-opus or opuslib).
  - Investigate existing references to Opus in the project.
  - Convert raw PCM frames to Opus for outbound data, and decode incoming Opus frames to PCM for any further processing like speech-to-text.

### B. Speech-to-Text Integration

- [ ] Decide whether to do real-time STT or batch after capturing data.
  - For real-time STT, pass each segment of decoded audio frames to the STT engine (e.g., open-source model or a cloud-based STT service).
  - For proof-of-concept, you can temporarily skip or stub out STT code.

[CODE START - Pseudocode for Real-Time STT]
# in speech_to_text_integration.py

def process_audio_frame(opus_frame):
    pcm_frame = opus_decoder.decode(opus_frame)
    text = stt_engine.recognize(pcm_frame)
    return text
[CODE END]

### C. Frontend Integration (Placeholder)

- [ ] Capture audio on the client side.
  - Use Web Audio API or getUserMedia to access the microphone.
  - Encode audio segments in Opus if possible (some browsers have built-in support; otherwise, do raw PCM and let the server handle encoding).

- [ ] Connect to the WebSocket endpoint (e.g., wss://server:8000/ws/voice).
  - Send audio data in small chunks (e.g., 20 ms frames).
  - Receive the loopback audio frames, decode them, and play them.

[CODE START - Sample WebSocket Connection in JavaScript]
const ws = new WebSocket('wss://server:8000/ws/voice');
ws.onopen = () => {
  // when capturing microphone data, send to server
  // ws.send(encodedOpusData);
};

ws.onmessage = (event) => {
  // decode the incoming data and play back
};
[CODE END]

### D. Testing and Debugging

- [ ] Add logs in "backend/voice_server.py" to confirm receipt of audio frames, transformation to Opus, loopback.
- [ ] Test locally with a microphone to confirm you can speak and hear your voice repeated.
- [ ] Validate that latency is acceptable, and logs do not show errors.

---

## 4. Timeline and Next Steps

1. **Backend**  
   - [ ] Implement the new "voice_server.py" with WebSocket endpoints.  
   - [ ] Integrate Opus for encoding/decoding.  

2. **Frontend**  
   - [ ] Add client-side code for capturing microphone input, opening WebSocket.  
   - [ ] Test loopback functionality.  

3. **Speech-to-Text**  
   - [ ] (Optional) Implement real-time or post-call STT.  
   - [ ] Decide on final architecture for passing recognized text back to the client or storing it.  

4. **Cleanup and Documentation**  
   - [ ] Write usage notes in "docs/todo.txt" once the feature is complete.  
   - [ ] Possibly add new environment variables or configurations for audio streaming.

---

## 5. Final Notes

- This plan should be flexible as you begin implementing. Any library differences or architectural constraints discovered may adjust the approach.  
- Keep an eye on Opus library dependencies and ensure "backend/requirements.dev.txt" or "requirements.txt" is updated accordingly.  
- Document as you go to make it easier for others to build on your work.

**End of Plan**