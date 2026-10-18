import cv2
import numpy as np
import base64
import json
import os
from google import genai
from google.genai import types

class GeminiBirdShowBridge:
    def __init__(self):
        self.system_instruction = (
            "You are the witty, charismatic, musical AI director and performer of an animatronic tropical bird show! "
            "You control two tall rear parrots (Parrot 1 on the Left, Parrot 2 on the Right) on 3-DOF perches, "
            "a center small bird with moving motor and chirping mouth, and two small side birds with relay-driven chirp circuits and spotlights. "
            "Your job is to:\n"
            "1. Deliver lively, entertaining, humorous, or musical responses as part of the tropical bird show!\n"
            "2. Describe what you see in front of the stage when camera images are provided.\n"
            "3. Trigger show performances, parrot selection switches, spotlight movements, or bird chirping dances when requested by the audience.\n"
            "Keep spoken/chat responses lively, theatrical, and concise (1-3 sentences)."
        )

    def detect_hand_gestures(self, frame):
        """
        Analyzes camera frame for hand gestures (skin color segmentation + contour convexity defects)
        Returns: (gesture_name, finger_count, annotated_frame)
        """
        try:
            resized = cv2.resize(frame, (320, 240))
            blur = cv2.GaussianBlur(resized, (5, 5), 0)
            hsv = cv2.cvtColor(blur, cv2.COLOR_BGR2HSV)

            lower_skin = np.array([0, 20, 70], dtype=np.uint8)
            upper_skin = np.array([20, 255, 255], dtype=np.uint8)
            mask = cv2.inRange(hsv, lower_skin, upper_skin)

            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            mask = cv2.erode(mask, kernel, iterations=1)
            mask = cv2.dilate(mask, kernel, iterations=2)

            contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return "None", 0, frame

            max_contour = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(max_contour)

            if area < 3000:
                return "None", 0, frame

            hull = cv2.convexHull(max_contour, returnPoints=False)
            if hull is None or len(hull) < 3:
                return "None", 0, frame

            defects = cv2.convexityDefects(max_contour, hull)
            finger_count = 0

            if defects is not None:
                for i in range(defects.shape[0]):
                    s, e, f, d = defects[i, 0]
                    start = tuple(max_contour[s][0])
                    end = tuple(max_contour[e][0])
                    far = tuple(max_contour[f][0])

                    a = np.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2)
                    b = np.sqrt((far[0] - start[0])**2 + (far[1] - start[1])**2)
                    c = np.sqrt((end[0] - far[0])**2 + (end[1] - far[1])**2)

                    angle = np.arccos((b**2 + c**2 - a**2) / (2 * b * c + 1e-5))

                    if angle <= np.pi / 2 and d > 1200:
                        finger_count += 1

                finger_count += 1

            gesture = "None"
            if finger_count >= 4:
                gesture = "5_FINGERS_FORWARD"
            elif finger_count == 2 or finger_count == 3:
                gesture = "2_FINGERS_WAVE"
            elif finger_count == 1:
                gesture = "1_FINGER_ATTACK"

            return gesture, finger_count, frame
        except Exception as e:
            return "None", 0, frame

    def generate_chat_response(self, api_key, user_text="", image_bytes=None):
        if not api_key:
            return {
                "text": "Please provide a valid Google Gemini API Key in settings to enable AI speech and show performance features.",
                "action": None
            }

        client = genai.Client(api_key=api_key)

        tools = [
            types.Tool(function_declarations=[
                types.FunctionDeclaration(
                    name="set_parrot_sync",
                    description="Sets which parrot syncs with the AI speech (Parrot 1 Left, Parrot 2 Right, or Parrots Take Turns).",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "mode": types.Schema(
                                type=types.Type.STRING,
                                enum=["parrot1", "parrot2", "turns"],
                                description="Sync mode selection: 'parrot1' (Left), 'parrot2' (Right), or 'turns' (Alternating)"
                            )
                        },
                        required=["mode"]
                    )
                ),
                types.FunctionDeclaration(
                    name="trigger_all_birds_chirp_dance",
                    description="Triggers a full animatronic bird dance: wings flapping, eyes blinking, perches swaying, small bird chirping relays active, and spotlights flashing.",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "theme": types.Schema(type=types.Type.STRING, description="Theme or song name for the dance performance")
                        }
                    )
                ),
                types.FunctionDeclaration(
                    name="set_spotlights",
                    description="Controls 2-DOF spotlight positions and intensities for Parrot 1 and Parrot 2.",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "p1_pan": types.Schema(type=types.Type.NUMBER),
                            "p1_tilt": types.Schema(type=types.Type.NUMBER),
                            "p1_intensity": types.Schema(type=types.Type.NUMBER),
                            "p2_pan": types.Schema(type=types.Type.NUMBER),
                            "p2_tilt": types.Schema(type=types.Type.NUMBER),
                            "p2_intensity": types.Schema(type=types.Type.NUMBER)
                        }
                    )
                ),
                types.FunctionDeclaration(
                    name="rotate_main_base",
                    description="Rotates the main stage platform servo.",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "angle": types.Schema(type=types.Type.NUMBER, description="Angle from 0 to 180 degrees")
                        },
                        required=["angle"]
                    )
                )
            ])
        ]

        contents = []

        if image_bytes:
            contents.append(types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/jpeg"
            ))

        prompt_text = user_text if user_text else "Welcome the audience to the Animatronic Bird Show and start a fun performance!"
        contents.append(prompt_text)

        config = types.GenerateContentConfig(
            system_instruction=self.system_instruction,
            tools=tools,
            temperature=0.75
        )

        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=contents,
                config=config
            )

            action = None
            text_response = response.text or ""

            if response.function_calls:
                call = response.function_calls[0]
                args_dict = {}
                if hasattr(call.args, "items"):
                    args_dict = {k: v for k, v in call.args.items()}
                elif isinstance(call.args, dict):
                    args_dict = call.args

                action = {
                    "name": call.name,
                    "args": args_dict
                }
                if not text_response:
                    text_response = f"Executing show command: {call.name}"

            return {
                "text": text_response,
                "action": action
            }

        except Exception as e:
            return {
                "text": f"Gemini API Error: {str(e)}",
                "action": None
            }

    def generate_voice_chat_response(self, api_key, audio_bytes, mime_type="audio/webm", image_bytes=None):
        if not api_key:
            return {"text": "Please provide a valid Google Gemini API Key.", "action": None}

        client = genai.Client(api_key=api_key)

        tools = [
            types.Tool(function_declarations=[
                types.FunctionDeclaration(
                    name="set_parrot_sync",
                    description="Sets which parrot syncs with the AI speech (Parrot 1 Left, Parrot 2 Right, or Parrots Take Turns).",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties={
                            "mode": types.Schema(type=types.Type.STRING, enum=["parrot1", "parrot2", "turns"])
                        },
                        required=["mode"]
                    )
                ),
                types.FunctionDeclaration(
                    name="trigger_all_birds_chirp_dance",
                    description="Triggers a full animatronic bird dance.",
                    parameters=types.Schema(type=types.Type.OBJECT, properties={})
                )
            ])
        ]

        contents = []

        if audio_bytes:
            contents.append(types.Part.from_bytes(
                data=audio_bytes,
                mime_type=mime_type
            ))

        if image_bytes:
            contents.append(types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/jpeg"
            ))

        contents.append(
            "Listen to my spoken voice input in the audio file above.\n"
            "1. Transcribe the exact words I spoke.\n"
            "2. Respond to me in a cheerful, entertaining parrot show host voice (1-2 sentences).\n"
            "3. Call any show function tools if requested.\n\n"
            "Format your text response as:\n"
            "TRANSCRIPTION: [exact spoken words]\n"
            "RESPONSE: [your bird show response]"
        )

        config = types.GenerateContentConfig(
            system_instruction=self.system_instruction,
            tools=tools,
            temperature=0.75
        )

        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=contents,
                config=config
            )

            action = None
            raw_text = response.text or ""
            user_transcription = ""
            text_response = raw_text

            if "TRANSCRIPTION:" in raw_text:
                parts = raw_text.split("RESPONSE:", 1)
                user_transcription = parts[0].replace("TRANSCRIPTION:", "").strip()
                if len(parts) > 1:
                    text_response = parts[1].strip()

            if response.function_calls:
                call = response.function_calls[0]
                args_dict = {}
                if hasattr(call.args, "items"):
                    args_dict = {k: v for k, v in call.args.items()}
                elif isinstance(call.args, dict):
                    args_dict = call.args

                action = {"name": call.name, "args": args_dict}
                if not text_response:
                    text_response = f"Executing show command: {call.name}"

            return {
                "transcription": user_transcription,
                "text": text_response,
                "action": action
            }

        except Exception as e:
            return {"text": f"Gemini Voice Processing Error: {str(e)}", "action": None}
