#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import sys
import cv2
import base64
import threading
import time
import random
import urllib.parse
import re
import math
from gemini_bridge import GeminiBirdShowBridge
import numpy as np

PORT = int(os.environ.get("PORT", 1290))
HOST = os.environ.get("HOST", os.environ.get("IP", "127.0.0.1"))
DIRECTORY = os.environ.get("DIRECTORY", os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"))

def generate_synthetic_camera_frame():
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    frame[:, :] = (20, 30, 40)
    cv2.putText(frame, "ANIMATRONIC BIRD SHOW CAMERA FEED", (60, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 240, 255), 2)
    cv2.putText(frame, "STATUS: Virtual Stage Feed Active", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (160, 255, 160), 1)
    t_str = time.strftime("%H:%M:%S")
    cv2.putText(frame, f"LIVE TIME: {t_str}", (220, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    return frame

class CameraStream:
    def __init__(self, source="usb"):
        self.source = str(source).lower()
        self.cap = None
        self.picam2 = None
        self.frame = None
        self.lock = threading.Lock()
        self.running = True
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()

    def set_source(self, source):
        with self.lock:
            self.source = str(source).lower()
            self._close_cameras()
            self.frame = None

    def reset(self):
        with self.lock:
            self._close_cameras()
            self.frame = None

    def _close_cameras(self):
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        if self.picam2:
            try:
                self.picam2.stop()
                self.picam2.close()
            except Exception:
                pass
            self.picam2 = None

    def _update(self):
        while self.running:
            with self.lock:
                cur_source = self.source

            if cur_source in ["csi", "picamera", "raspberry_pi", "ov5647"]:
                if self.picam2 is None:
                    self._close_cameras()
                    try:
                        from picamera2 import Picamera2
                        p = Picamera2()
                        config = p.create_preview_configuration(main={'size': (640, 480)})
                        p.configure(config)
                        p.start()
                        time.sleep(0.3)
                        self.picam2 = p
                    except Exception as e:
                        self.picam2 = None
                        time.sleep(1.0)
                        continue

                try:
                    frame_array = self.picam2.capture_array('main')
                    if frame_array is not None and frame_array.size > 0:
                        frame_bgr = cv2.cvtColor(frame_array, cv2.COLOR_RGBA2BGR) if frame_array.shape[2] == 4 else frame_array
                        with self.lock:
                            self.frame = frame_bgr
                    time.sleep(0.04)
                except Exception:
                    self._close_cameras()
                    time.sleep(0.5)

            else:
                if self.cap is None or not self.cap.isOpened():
                    self._close_cameras()
                    candidates = [8, 23, 0, 1, 6, 2]
                    if cur_source.isdigit():
                        candidates.insert(0, int(cur_source))
                    candidates = list(dict.fromkeys(candidates))

                    opened = False
                    for idx in candidates:
                        try:
                            cap = cv2.VideoCapture(idx, cv2.CAP_V4L2)
                            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                            if cap.isOpened():
                                ret, frame = cap.read()
                                if ret and frame is not None and frame.size > 0:
                                    self.cap = cap
                                    if self.lock.acquire(timeout=0.05):
                                        try:
                                            self.frame = frame
                                        finally:
                                            self.lock.release()
                                    opened = True
                                    break
                                else:
                                    cap.release()
                        except Exception:
                            pass

                    if not opened:
                        with self.lock:
                            self.frame = generate_synthetic_camera_frame()
                        time.sleep(2.0)

                if self.cap and self.cap.isOpened():
                    try:
                        ret, frame = self.cap.read()
                        if ret and frame is not None and frame.size > 0:
                            if self.lock.acquire(timeout=0.05):
                                try:
                                    self.frame = frame
                                finally:
                                    self.lock.release()
                            time.sleep(0.04)
                        else:
                            self._close_cameras()
                            time.sleep(1.0)
                    except Exception:
                        self._close_cameras()
                        time.sleep(1.0)
                else:
                    time.sleep(0.5)

    def get_frame(self):
        if self.lock.acquire(timeout=0.05):
            try:
                if self.frame is not None:
                    return self.frame.copy()
            finally:
                self.lock.release()
        return generate_synthetic_camera_frame()

camera_stream = CameraStream("usb")
gemini_bridge = GeminiBirdShowBridge()

# --- BIRD SHOW GLOBAL HARDWARE STATE ---

# AI Sync Mode: 'parrot1', 'parrot2', or 'turns'
bird_show_state = {
    "ai_sync_mode": "turns",
    "active_speaker": "parrot1",
    "is_speaking": False,

    # Rear Tall Parrots (1: Left, 2: Right)
    "parrot1": {
        # L298 Channel A: 'off', 'mouth_open' (normal polarity), 'eyes_blink' (reverse polarity)
        "mouth_eyes_channel_a": "off",
        # L298 Channel B: Wings flap active
        "wings_channel_b": False,
        # 3-DOF Perch Servos (Degrees: 0-180)
        "perch": {"turn": 90, "bow": 90, "shimmy": 90},
        # 2-DOF Spotlight
        "spotlight": {"pan": 90, "tilt": 90, "intensity": 100},
        "voice": "ai_female_us"
    },

    "parrot2": {
        "mouth_eyes_channel_a": "off",
        "wings_channel_b": False,
        "perch": {"turn": 90, "bow": 90, "shimmy": 90},
        "spotlight": {"pan": 90, "tilt": 90, "intensity": 100},
        "voice": "ai_male_us"
    },

    # Center Front Small Bird (3-DOF Perch & Mouth Chirp; NO Spotlight)
    "center_bird": {
        "motor_moving": False,
        "mouth_chirp": False,
        "perch": {"turn": 90, "bow": 90, "shimmy": 90}
    },

    # 4 Small Birds:
    # 2 Front Small Birds (Spotlight, Chirp Relay & Motor)
    "front_left_bird": {
        "spotlight": True,
        "moving": False,
        "relay_chirp": False
    },
    "front_right_bird": {
        "spotlight": True,
        "moving": False,
        "relay_chirp": False
    },

    # 2 Rear Small Birds (Spotlight & Motor)
    "rear_left_bird": {
        "spotlight": True,
        "moving": False
    },
    "rear_right_bird": {
        "spotlight": True,
        "moving": False
    },

    # Backwards compatibility aliases
    "left_bird": {
        "spotlight": True,
        "moving": False,
        "relay_chirp": False
    },
    "right_bird": {
        "spotlight": True,
        "moving": False,
        "relay_chirp": False
    },

    # Main Base Servo underneath allowing whole stage to turn CW / CCW
    "main_base": {
        "servo_angle": 90,
        "random_moving": True
    }
}

# Lock for state mutations
state_lock = threading.Lock()

def update_simulated_bird_movements():
    """Simulates background random perches/wings/eyes/relays/base movements during performance."""
    phrase_counter = 0
    blink_timer = 0

    while True:
        time.sleep(0.15)
        with state_lock:
            speaking = bird_show_state["is_speaking"]
            base_moving = bird_show_state["main_base"]["random_moving"]

            # 1. Random slow stage base movement
            if base_moving or speaking:
                cur_angle = bird_show_state["main_base"]["servo_angle"]
                base_dir = bird_show_state["main_base"].get("dir", 1)
                if cur_angle >= 145:
                    base_dir = -1
                elif cur_angle <= 35:
                    base_dir = 1
                elif random.random() < 0.08:
                    base_dir = -base_dir

                bird_show_state["main_base"]["dir"] = base_dir
                step = random.randint(2, 5) * base_dir
                bird_show_state["main_base"]["servo_angle"] = max(30, min(150, cur_angle + step))

            # 2. Both parrots blink eyes occasionally and flap wings
            blink_timer += 1
            if blink_timer % 10 == 0 or random.random() < 0.15:
                # Reverse polarity on Channel A for continuous blinking eyes pulse
                if bird_show_state["parrot1"]["mouth_eyes_channel_a"] != "mouth_open":
                    bird_show_state["parrot1"]["mouth_eyes_channel_a"] = random.choice(["eyes_blink", "off"])
                if bird_show_state["parrot2"]["mouth_eyes_channel_a"] != "mouth_open":
                    bird_show_state["parrot2"]["mouth_eyes_channel_a"] = random.choice(["eyes_blink", "off"])

            # Flap wings together or alternately
            if speaking or random.random() < 0.4:
                bird_show_state["parrot1"]["wings_channel_b"] = random.choice([True, False, True])
                bird_show_state["parrot2"]["wings_channel_b"] = random.choice([True, False, True])
            else:
                bird_show_state["parrot1"]["wings_channel_b"] = False
                bird_show_state["parrot2"]["wings_channel_b"] = False

            # Random 3-DOF Perch motions for both parrots
            for p in ["parrot1", "parrot2"]:
                if speaking or random.random() < 0.3:
                    perch = bird_show_state[p]["perch"]
                    perch["turn"] = max(45, min(135, perch["turn"] + random.randint(-4, 4)))
                    perch["bow"] = max(60, min(120, perch["bow"] + random.randint(-3, 3)))
                    perch["shimmy"] = max(70, min(110, perch["shimmy"] + random.randint(-5, 5)))

            # 2-DOF Spotlight circular scanning for the active talking parrot
            if speaking:
                t_sec = time.time()
                circ_pan = 90 + int(math.sin(t_sec * 3.5) * 16)
                circ_tilt = 90 + int(math.cos(t_sec * 3.5) * 12)

                active_p = bird_show_state["active_speaker"]
                if active_p in ["parrot1", "parrot2"]:
                    bird_show_state[active_p]["spotlight"]["pan"] = max(30, min(150, circ_pan))
                    bird_show_state[active_p]["spotlight"]["tilt"] = max(30, min(150, circ_tilt))
                    bird_show_state[active_p]["spotlight"]["intensity"] = 100

                    # Dim non-talking parrot spotlight
                    other_p = "parrot2" if active_p == "parrot1" else "parrot1"
                    bird_show_state[other_p]["spotlight"]["intensity"] = 25
            else:
                for p in ["parrot1", "parrot2"]:
                    bird_show_state[p]["spotlight"]["intensity"] = 100

            # Small birds activities when speaking or active
            if speaking or random.random() < 0.35:
                # Center Small Bird 3-DOF Perch moves randomly in response
                c_perch = bird_show_state["center_bird"]["perch"]
                c_perch["turn"] = max(45, min(135, c_perch["turn"] + random.randint(-6, 6)))
                c_perch["bow"] = max(60, min(120, c_perch["bow"] + random.randint(-5, 5)))
                c_perch["shimmy"] = max(70, min(110, c_perch["shimmy"] + random.randint(-6, 6)))

            if speaking:
                bird_show_state["center_bird"]["motor_moving"] = True
                bird_show_state["center_bird"]["mouth_chirp"] = random.choice([True, False])

                for name, has_relay in [("front_left_bird", True), ("front_right_bird", True), ("rear_left_bird", False), ("rear_right_bird", False), ("left_bird", True), ("right_bird", True)]:
                    if name in bird_show_state:
                        bird_show_state[name]["spotlight"] = random.choice([True, False])
                        bird_show_state[name]["moving"] = True
                        if has_relay and "relay_chirp" in bird_show_state[name]:
                            bird_show_state[name]["relay_chirp"] = random.choice([True, False])
            else:
                bird_show_state["center_bird"]["motor_moving"] = False
                bird_show_state["center_bird"]["mouth_chirp"] = False

                for name in ["front_left_bird", "front_right_bird", "rear_left_bird", "rear_right_bird", "left_bird", "right_bird"]:
                    if name in bird_show_state:
                        bird_show_state[name]["moving"] = False
                        if "relay_chirp" in bird_show_state[name]:
                            bird_show_state[name]["relay_chirp"] = False

threading.Thread(target=update_simulated_bird_movements, daemon=True).start()

class BirdShowRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_HEAD(self):
        if self.path.startswith("/api/export-pdf"):
            self.send_response(200)
            self.send_header('Content-type', 'application/pdf')
            self.send_header('Content-Disposition', 'attachment; filename="Animatronic_Bird_Show_Wiring_Schematic.pdf"')
            self.end_headers()
        elif self.path.startswith("/api/export-csv"):
            self.send_response(200)
            self.send_header('Content-type', 'text/csv')
            self.send_header('Content-Disposition', 'attachment; filename="Animatronic_Bird_Show_Hardware_Pinout.csv"')
            self.end_headers()
        elif self.path.startswith("/api/"):
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
        else:
            super().do_HEAD()

    def do_GET(self):
        if self.path.startswith("/api/status"):
            self.send_json({
                "status": "online",
                "device": "Animatronic Bird Show Master Controller",
                "python_version": sys.version
            })
        elif self.path.startswith("/api/birds/state"):
            with state_lock:
                self.send_json(bird_show_state)
        elif self.path.startswith("/api/playlist"):
            audio_dir = os.path.join(DIRECTORY, "audio")
            os.makedirs(audio_dir, exist_ok=True)
            files = []
            for f in sorted(os.listdir(audio_dir)):
                if f.lower().endswith(('.mp3', '.wav', '.ogg', '.m4a', '.flac')):
                    files.append({
                        "filename": f,
                        "title": f.rsplit('.', 1)[0].replace('_', ' ').title(),
                        "url": f"/audio/{urllib.parse.quote(f)}"
                    })
            self.send_json({"songs": files})
        elif self.path.startswith("/api/camera/frame"):
            self.serve_camera_frame()
        elif self.path.startswith("/api/tts/speak"):
            query_params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            text_to_speak = query_params.get("text", ["Squawk! Welcome to the Bird Show!"])[0]
            req_voice = query_params.get("voice", [None])[0]
            req_parrot = query_params.get("parrot", [None])[0]

            # Toggle speaker if mode is 'turns'
            with state_lock:
                if req_parrot in ["parrot1", "parrot2"]:
                    bird_show_state["active_speaker"] = req_parrot
                else:
                    mode = bird_show_state["ai_sync_mode"]
                    if mode == "turns":
                        current = bird_show_state["active_speaker"]
                        bird_show_state["active_speaker"] = "parrot2" if current == "parrot1" else "parrot1"
                    elif mode in ["parrot1", "parrot2"]:
                        bird_show_state["active_speaker"] = mode
                active_speaker = bird_show_state["active_speaker"]
                bird_show_state["is_speaking"] = True

                if req_voice and req_voice != "auto":
                    voice_id = req_voice
                else:
                    voice_id = bird_show_state.get(active_speaker, {}).get("voice", "ai_female_us")

            try:
                from gtts import gTTS
                import io
                clean_text = re.sub(r'\*[^*]*\*', '', text_to_speak).strip() or "Squawk!"

                tld_map = {
                    "ai_female_us": ("en", "com"),
                    "ai_male_us": ("en", "us"),
                    "ai_female_uk": ("en", "co.uk"),
                    "ai_male_uk": ("en", "co.uk"),
                    "ai_female_au": ("en", "com.au"),
                    "ai_male_au": ("en", "com.au"),
                    "ai_female_ca": ("en", "ca"),
                    "ai_female_in": ("en", "co.in"),
                    "ai_spanish": ("es", "com"),
                    "ai_french": ("fr", "fr")
                }
                lang, tld = tld_map.get(voice_id, ("en", "com"))
                tts = gTTS(text=clean_text, lang=lang, tld=tld)
                mp3_fp = io.BytesIO()
                tts.write_to_fp(mp3_fp)
                mp3_fp.seek(0)
                audio_bytes = mp3_fp.read()

                self.send_response(200)
                self.send_header('Content-type', 'audio/mpeg')
                self.send_header('Cache-Control', 'no-cache')
                self.end_headers()
                self.wfile.write(audio_bytes)

            except Exception as e:
                self.send_json({"error": str(e)}, status=500)
            finally:
                def stop_speaking_delayed():
                    time.sleep(len(text_to_speak) * 0.08 + 1.0)
                    with state_lock:
                        bird_show_state["is_speaking"] = False
                        bird_show_state["parrot1"]["mouth_eyes_channel_a"] = "off"
                        bird_show_state["parrot2"]["mouth_eyes_channel_a"] = "off"
                threading.Thread(target=stop_speaking_delayed, daemon=True).start()

        elif self.path.startswith("/api/export-pdf"):
            pdf_bytes = self.generate_schematic_pdf()
            desktop_dir = os.path.expanduser("~/Desktop")
            if os.path.exists(desktop_dir):
                try:
                    with open(os.path.join(desktop_dir, "Animatronic_Bird_Show_Wiring_Schematic.pdf"), "wb") as f:
                        f.write(pdf_bytes)
                except Exception:
                    pass
            self.send_response(200)
            self.send_header('Content-type', 'application/pdf')
            self.send_header('Content-Disposition', 'attachment; filename="Animatronic_Bird_Show_Wiring_Schematic.pdf"')
            self.end_headers()
            self.wfile.write(pdf_bytes)

        elif self.path.startswith("/api/export-csv"):
            csv_path = os.path.join(DIRECTORY, "wiring_diagram.csv")
            if os.path.exists(csv_path):
                with open(csv_path, "rb") as f:
                    csv_bytes = f.read()
            else:
                csv_bytes = b"Subsystem,Pin,Signal\n"
            desktop_dir = os.path.expanduser("~/Desktop")
            if os.path.exists(desktop_dir):
                try:
                    with open(os.path.join(desktop_dir, "Animatronic_Bird_Show_Hardware_Pinout.csv"), "wb") as f:
                        f.write(csv_bytes)
                except Exception:
                    pass
            self.send_response(200)
            self.send_header('Content-type', 'text/csv')
            self.send_header('Content-Disposition', 'attachment; filename="Animatronic_Bird_Show_Hardware_Pinout.csv"')
            self.end_headers()
            self.wfile.write(csv_bytes)

        elif self.path.startswith("/api/wiring-schema"):
            self.send_json({
                "device": "Animatronic Bird Show Master",
                "i2c_bus": {"sda": "GPIO 2 (Pin 3)", "scl": "GPIO 3 (Pin 5)", "pca9685_address": "0x40"},
                "pca9685_channels": {
                    "0": "Parrot 1 Turn Servo (Yaw)",
                    "1": "Parrot 1 Bow Servo (Pitch)",
                    "2": "Parrot 1 Shimmy Servo (Roll)",
                    "3": "Parrot 1 Spotlight Pan Servo",
                    "4": "Parrot 1 Spotlight Tilt Servo",
                    "5": "Parrot 1 Spotlight PWM Dimmer",
                    "6": "Parrot 2 Turn Servo (Yaw)",
                    "7": "Parrot 2 Bow Servo (Pitch)",
                    "8": "Parrot 2 Shimmy Servo (Roll)",
                    "9": "Parrot 2 Spotlight Pan Servo",
                    "10": "Parrot 2 Spotlight Tilt Servo",
                    "11": "Parrot 2 Spotlight PWM Dimmer",
                    "12": "Center Small Bird Turn Servo (Yaw)",
                    "13": "Center Small Bird Bow Servo (Pitch)",
                    "14": "Center Small Bird Shimmy Servo (Roll)",
                    "15": "Main Stage Turntable Base Servo"
                },
                "l298_drivers": {
                    "parrot1": {"ena": 18, "in1": 23, "in2": 24, "enb": 19, "in3": 25, "in4": 8},
                    "parrot2": {"ena": 12, "in1": 16, "in2": 20, "enb": 13, "in3": 21, "in4": 26}
                },
                "relays": {
                    "left_bird_chirp": 17,
                    "right_bird_chirp": 27,
                    "center_bird_motor": 22
                }
            })

        else:
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else "{}"
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {}

        if self.path == "/api/birds/sync_mode":
            mode = data.get("mode", "turns")
            if mode in ["parrot1", "parrot2", "turns"]:
                with state_lock:
                    bird_show_state["ai_sync_mode"] = mode
                    if mode in ["parrot1", "parrot2"]:
                        bird_show_state["active_speaker"] = mode
            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/playlist/upload":
            filename = data.get("filename", "custom_song.mp3")
            file_b64 = data.get("file_b64", "")
            if filename and file_b64:
                clean_filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
                audio_dir = os.path.join(DIRECTORY, "audio")
                os.makedirs(audio_dir, exist_ok=True)
                file_bytes = base64.b64decode(file_b64)
                filepath = os.path.join(audio_dir, clean_filename)
                with open(filepath, "wb") as f:
                    f.write(file_bytes)
                self.send_json({"success": True, "filename": clean_filename, "url": f"/audio/{clean_filename}"})
            else:
                self.send_json({"error": "Invalid upload payload"}, status=400)

        elif self.path == "/api/playlist/lipsync_state":
            speaker = data.get("speaker", "parrot1")
            is_singing = bool(data.get("is_singing", False))
            mouth_open = bool(data.get("mouth_open", False))
            beat_pulse = bool(data.get("beat_pulse", False))

            with state_lock:
                bird_show_state["is_speaking"] = is_singing
                if speaker in ["parrot1", "parrot2"]:
                    bird_show_state["active_speaker"] = speaker

                if is_singing:
                    if speaker == "parrot1":
                        bird_show_state["parrot1"]["mouth_eyes_channel_a"] = "mouth_open" if mouth_open else "off"
                        bird_show_state["parrot2"]["mouth_eyes_channel_a"] = "eyes_blink" if random.random() < 0.2 else "off"
                    elif speaker == "parrot2":
                        bird_show_state["parrot2"]["mouth_eyes_channel_a"] = "mouth_open" if mouth_open else "off"
                        bird_show_state["parrot1"]["mouth_eyes_channel_a"] = "eyes_blink" if random.random() < 0.2 else "off"

                    if beat_pulse:
                        bird_show_state["parrot1"]["wings_channel_b"] = True
                        bird_show_state["parrot2"]["wings_channel_b"] = True
                        bird_show_state["left_bird"]["relay_chirp"] = random.choice([True, False])
                        bird_show_state["right_bird"]["relay_chirp"] = random.choice([True, False])

            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/birds/state_update":
            with state_lock:
                for k, v in data.items():
                    if k in bird_show_state and isinstance(v, dict):
                        bird_show_state[k].update(v)
                    elif k in bird_show_state:
                        bird_show_state[k] = v
            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/birds/parrot":
            p_id = data.get("parrot", "parrot1")
            if p_id in ["parrot1", "parrot2"]:
                with state_lock:
                    if "mouth_eyes" in data:
                        bird_show_state[p_id]["mouth_eyes_channel_a"] = data["mouth_eyes"]
                    if "wings" in data:
                        bird_show_state[p_id]["wings_channel_b"] = bool(data["wings"])
                    if "voice" in data:
                        bird_show_state[p_id]["voice"] = str(data["voice"])
            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/birds/perch":
            p_id = data.get("parrot", "parrot1")
            if p_id in ["parrot1", "parrot2"]:
                with state_lock:
                    perch = bird_show_state[p_id]["perch"]
                    if "turn" in data: perch["turn"] = int(data["turn"])
                    if "bow" in data: perch["bow"] = int(data["bow"])
                    if "shimmy" in data: perch["shimmy"] = int(data["shimmy"])
            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/birds/spotlight":
            p_id = data.get("spotlight", "parrot1")
            if p_id in ["parrot1", "parrot2"]:
                with state_lock:
                    spot = bird_show_state[p_id]["spotlight"]
                    if "pan" in data: spot["pan"] = int(data["pan"])
                    if "tilt" in data: spot["tilt"] = int(data["tilt"])
                    if "intensity" in data: spot["intensity"] = int(data["intensity"])
            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/birds/small_birds":
            with state_lock:
                if "center" in data and isinstance(data["center"], dict):
                    if "perch" in data["center"] and isinstance(data["center"]["perch"], dict):
                        if "perch" not in bird_show_state["center_bird"]:
                            bird_show_state["center_bird"]["perch"] = {"turn": 90, "bow": 90, "shimmy": 90}
                        bird_show_state["center_bird"]["perch"].update(data["center"]["perch"])
                    for k, v in data["center"].items():
                        if k != "perch":
                            bird_show_state["center_bird"][k] = v
                
                if "front_left" in data and isinstance(data["front_left"], dict):
                    bird_show_state["front_left_bird"].update(data["front_left"])
                    bird_show_state["left_bird"].update(data["front_left"])
                elif "left" in data and isinstance(data["left"], dict):
                    bird_show_state["front_left_bird"].update(data["left"])
                    bird_show_state["left_bird"].update(data["left"])

                if "front_right" in data and isinstance(data["front_right"], dict):
                    bird_show_state["front_right_bird"].update(data["front_right"])
                    bird_show_state["right_bird"].update(data["front_right"])
                elif "right" in data and isinstance(data["right"], dict):
                    bird_show_state["front_right_bird"].update(data["right"])
                    bird_show_state["right_bird"].update(data["right"])

                if "rear_left" in data and isinstance(data["rear_left"], dict):
                    bird_show_state["rear_left_bird"].update(data["rear_left"])

                if "rear_right" in data and isinstance(data["rear_right"], dict):
                    bird_show_state["rear_right_bird"].update(data["rear_right"])

            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/birds/main_base":
            with state_lock:
                if "angle" in data:
                    bird_show_state["main_base"]["servo_angle"] = int(data["angle"])
                if "random_moving" in data:
                    bird_show_state["main_base"]["random_moving"] = bool(data["random_moving"])
            self.send_json({"success": True, "state": bird_show_state})

        elif self.path == "/api/camera/select":
            source = data.get("source", "usb")
            camera_stream.set_source(source)
            self.send_json({"success": True, "active_source": source})

        elif self.path == "/api/camera/reset":
            camera_stream.reset()
            self.send_json({"success": True, "message": "Camera reset successfully", "active_source": camera_stream.source})

        elif self.path == "/api/gemini/chat":
            user_text = data.get("prompt", "")
            DEFAULT_GEMINI_KEY = ""
            api_key = data.get("api_key") or os.environ.get("GEMINI_API_KEY") or DEFAULT_GEMINI_KEY
            include_vision = data.get("include_vision", True)

            image_bytes = self.capture_camera_bytes() if include_vision else None
            result = gemini_bridge.generate_chat_response(api_key, user_text, image_bytes)

            if result.get("action"):
                act = result["action"]
                if act.get("name") == "set_parrot_sync":
                    m = act.get("args", {}).get("mode", "turns")
                    with state_lock:
                        bird_show_state["ai_sync_mode"] = m

            self.send_json(result)

        elif self.path == "/api/gemini/voice":
            DEFAULT_GEMINI_KEY = ""
            api_key = data.get("api_key") or os.environ.get("GEMINI_API_KEY") or DEFAULT_GEMINI_KEY
            audio_b64 = data.get("audio_b64", "")
            mime_type = data.get("mime_type", "audio/webm")
            include_vision = data.get("include_vision", True)

            audio_bytes = base64.b64decode(audio_b64) if audio_b64 else None
            image_bytes = self.capture_camera_bytes() if include_vision else None

            result = gemini_bridge.generate_voice_chat_response(api_key, audio_bytes, mime_type, image_bytes)
            self.send_json(result)

        elif self.path == "/api/export-python":
            python_script = self.generate_hardware_script(data)
            self.send_response(200)
            self.send_header('Content-type', 'application/x-python')
            self.send_header('Content-Disposition', 'attachment; filename="bird_show_hardware_master.py"')
            self.end_headers()
            self.wfile.write(python_script.encode('utf-8'))

        else:
            self.send_json({"error": "Endpoint not found"}, status=404)

    def capture_camera_frame(self):
        return camera_stream.get_frame()

    def capture_camera_bytes(self):
        frame = self.capture_camera_frame()
        if frame is None:
            frame = generate_synthetic_camera_frame()
        ret, jpeg = cv2.imencode('.jpg', frame)
        return jpeg.tobytes() if ret else None

    def serve_camera_frame(self):
        jpeg_bytes = self.capture_camera_bytes()
        if jpeg_bytes is None:
            try:
                self.send_response(503)
                self.end_headers()
            except Exception:
                pass
            return
        try:
            self.send_response(200)
            self.send_header('Content-type', 'image/jpeg')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(jpeg_bytes)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def send_json(self, data, status=200):
        try:
            self.send_response(status)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def generate_hardware_script(self, data):
        script = f'''#!/usr/bin/env python3
"""
Animatronic Bird Show Master Raspberry Pi Hardware Driver
Controls:
- 2x L298 Motor Controllers for Rear Tall Parrots:
    * Channel A: Mouth (Normal Polarity) & Blinking Eyes (Reverse Polarity)
    * Channel B: Flapping Wings
- 3-DOF Servo Perches for Parrot 1 & Parrot 2 (Turn, Bow, Shimmy)
- 2-DOF Spotlight Servo Bases for Parrot 1 & Parrot 2 (Pan, Tilt + PWM LED Dimmer)
- Center Small Bird Motor & Stationary Spotlight
- Left & Right Small Birds with Relays for Chirp Circuits
- Main Stage Rotating Base Servo
"""

import time
import random
import RPi.GPIO as GPIO

# --- GPIO PIN CONFIGURATIONS ---

# L298 Controller #1 (Parrot 1 - Left Tall Parrot)
L298_1_ENA = 18  # Channel A PWM (Mouth/Eyes)
L298_1_IN1 = 23  # Direction IN1
L298_1_IN2 = 24  # Direction IN2
L298_1_ENB = 19  # Channel B PWM (Wings Flap)
L298_1_IN3 = 25  # Direction IN3
L298_1_IN4 = 8   # Direction IN4

# L298 Controller #2 (Parrot 2 - Right Tall Parrot)
L298_2_ENA = 12  # Channel A PWM (Mouth/Eyes)
L298_2_IN1 = 16  # Direction IN1
L298_2_IN2 = 20  # Direction IN2
L298_2_ENB = 13  # Channel B PWM (Wings Flap)
L298_2_IN3 = 21  # Direction IN3
L298_2_IN4 = 26  # Direction IN4

# Small Bird Chirp Circuit Relays
RELAY_LEFT_BIRD_CHIRP = 17
RELAY_RIGHT_BIRD_CHIRP = 27
CENTER_BIRD_MOTOR = 22

# Setup GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

OUTPUT_PINS = [
    L298_1_ENA, L298_1_IN1, L298_1_IN2, L298_1_ENB, L298_1_IN3, L298_1_IN4,
    L298_2_ENA, L298_2_IN1, L298_2_IN2, L298_2_ENB, L298_2_IN3, L298_2_IN4,
    RELAY_LEFT_BIRD_CHIRP, RELAY_RIGHT_BIRD_CHIRP, CENTER_BIRD_MOTOR
]
GPIO.setup(OUTPUT_PINS, GPIO.OUT)

pwm_p1_cha = GPIO.PWM(L298_1_ENA, 1000)
pwm_p1_chb = GPIO.PWM(L298_1_ENB, 1000)
pwm_p2_cha = GPIO.PWM(L298_2_ENA, 1000)
pwm_p2_chb = GPIO.PWM(L298_2_ENB, 1000)

for p in [pwm_p1_cha, pwm_p1_chb, pwm_p2_cha, pwm_p2_chb]:
    p.start(0)

def set_parrot_mouth_eyes(parrot_num, state="off"):
    """
    Channel A:
    'mouth_open': Normal Polarity -> Mouth Opens
    'eyes_blink': Reverse Polarity -> Eyes Blink Continuously
    'off': No Power -> Both Off
    """
    in1 = L298_1_IN1 if parrot_num == 1 else L298_2_IN1
    in2 = L298_1_IN2 if parrot_num == 1 else L298_2_IN2
    pwm = pwm_p1_cha if parrot_num == 1 else pwm_p2_cha

    if state == "mouth_open":
        GPIO.output(in1, GPIO.HIGH)
        GPIO.output(in2, GPIO.LOW)
        pwm.ChangeDutyCycle(100)
    elif state == "eyes_blink":
        GPIO.output(in1, GPIO.LOW)
        GPIO.output(in2, GPIO.HIGH)
        pwm.ChangeDutyCycle(100)
    else:
        GPIO.output(in1, GPIO.LOW)
        GPIO.output(in2, GPIO.LOW)
        pwm.ChangeDutyCycle(0)

def set_parrot_wings(parrot_num, active=False):
    """Channel B: Controls flapping wings."""
    in3 = L298_1_IN3 if parrot_num == 1 else L298_2_IN3
    in4 = L298_1_IN4 if parrot_num == 1 else L298_2_IN4
    pwm = pwm_p1_chb if parrot_num == 1 else pwm_p2_chb

    if active:
        GPIO.output(in3, GPIO.HIGH)
        GPIO.output(in4, GPIO.LOW)
        pwm.ChangeDutyCycle(100)
    else:
        pwm.ChangeDutyCycle(0)

def trigger_chirp_relay(bird="left", active=False):
    pin = RELAY_LEFT_BIRD_CHIRP if bird == "left" else RELAY_RIGHT_BIRD_CHIRP
    GPIO.output(pin, GPIO.HIGH if active else GPIO.LOW)

def main():
    print("Animatronic Bird Show Master Hardware Driver Initialized!")
    print("Testing Parrot 1 & Parrot 2 Mouth, Eyes, Wings, and Small Bird Chirp Relays...")

    # Test Parrot 1 Mouth & Wings
    set_parrot_mouth_eyes(1, "mouth_open")
    set_parrot_wings(1, True)
    time.sleep(1.5)

    # Test Parrot 1 Blinking Eyes (Reverse Polarity)
    set_parrot_mouth_eyes(1, "eyes_blink")
    time.sleep(1.5)
    set_parrot_mouth_eyes(1, "off")
    set_parrot_wings(1, False)

    # Test Parrot 2 Mouth & Wings
    set_parrot_mouth_eyes(2, "mouth_open")
    set_parrot_wings(2, True)
    time.sleep(1.5)

    # Test Parrot 2 Blinking Eyes
    set_parrot_mouth_eyes(2, "eyes_blink")
    time.sleep(1.5)
    set_parrot_mouth_eyes(2, "off")
    set_parrot_wings(2, False)

    # Test Small Bird Relays
    trigger_chirp_relay("left", True)
    time.sleep(0.5)
    trigger_chirp_relay("left", False)
    trigger_chirp_relay("right", True)
    time.sleep(0.5)
    trigger_chirp_relay("right", False)

    print("Hardware test completed successfully!")

if __name__ == "__main__":
    try:
        main()
    finally:
        GPIO.cleanup()
'''
        return script

    def generate_schematic_pdf(self):
        import io
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor('#003366'), spaceAfter=4)
        subtitle_style = ParagraphStyle('DocSubTitle', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=9, textColor=colors.HexColor('#444444'), spaceAfter=10)
        heading_style = ParagraphStyle('SectionHeading', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#0055a5'), spaceBefore=8, spaceAfter=4)
        cell_style = ParagraphStyle('TableCell', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=10, textColor=colors.HexColor('#111111'))
        header_cell_style = ParagraphStyle('TableHeaderCell', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.white)

        story = []

        # Title
        story.append(Paragraph("🦜 ANIMATRONIC BIRD SHOW - MASTER HARDWARE WIRING SCHEMATIC", title_style))
        story.append(Paragraph("Complete Pinout Map for Raspberry Pi 4/5, PCA9685 PWM Driver, Dual L298N Motor Controllers, Relays & Power Rails", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0055a5'), spaceBefore=2, spaceAfter=8))

        # Hardware Components Table
        story.append(Paragraph("⚡ Core System Hardware Overview", heading_style))
        overview_data = [
            [Paragraph("Module / Component", header_cell_style), Paragraph("Hardware Role & Signals", header_cell_style), Paragraph("Power Requirements", header_cell_style)],
            [Paragraph("<b>Raspberry Pi 4 / 5</b>", cell_style), Paragraph("Executes master server, Gemini AI, I2C bus (Pin 3 SDA, Pin 5 SCL), L298N triggers & Relays", cell_style), Paragraph("+5V @ 3A DC", cell_style)],
            [Paragraph("<b>PCA9685 16-Ch PWM Driver</b>", cell_style), Paragraph("I2C Address 0x40. Drives 16 PWM channels (3-DOF perches, 2-DOF spotlights, base turntable)", cell_style), Paragraph("+5V Logic / +5V-+6V 12A V+", cell_style)],
            [Paragraph("<b>Dual L298N Motor Drivers</b>", cell_style), Paragraph("Driver #1 (Parrot 1) & Driver #2 (Parrot 2) Mouth Solenoids, Blinking Eyes & Flapping Wings", cell_style), Paragraph("+5V/+6V High-Current Rail", cell_style)],
            [Paragraph("<b>2-Ch Relays & Transistor Driver</b>", cell_style), Paragraph("Relay #1 (GPIO 17) Left Bird Chirp, Relay #2 (GPIO 27) Right Bird Chirp, Center Bird Gearmotor (GPIO 22)", cell_style), Paragraph("+5V Logic VCC", cell_style)]
        ]
        t_overview = Table(overview_data, colWidths=[150, 430, 140])
        t_overview.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#003366')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#ffffff'), colors.HexColor('#f5f8ff')])
        ]))
        story.append(t_overview)
        story.append(Spacer(1, 8))

        # Complete Pinout Table
        story.append(Paragraph("📋 Complete GPIO & PCA9685 Pinout Lookup Table", heading_style))
        pinout_rows = [[
            Paragraph("Header / Module", header_cell_style),
            Paragraph("Pin / Ch #", header_cell_style),
            Paragraph("Signal Name", header_cell_style),
            Paragraph("Connected Hardware Module", header_cell_style),
            Paragraph("Terminal", header_cell_style),
            Paragraph("Function Description", header_cell_style)
        ]]

        pinout_data_items = [
            ("Raspberry Pi", "Pin 3", "GPIO 2 (SDA1)", "PCA9685 PWM Driver", "SDA Terminal", "I2C Serial Data Bus for 16-Ch Servo Controller"),
            ("Raspberry Pi", "Pin 5", "GPIO 3 (SCL1)", "PCA9685 PWM Driver", "SCL Terminal", "I2C Serial Clock Bus for 16-Ch Servo Controller"),
            ("Raspberry Pi", "Pin 11", "GPIO 17", "2-Channel Relay Board", "Relay #1 IN", "Front Left Small Bird Chirp Sound Relay"),
            ("Raspberry Pi", "Pin 12", "GPIO 18 (PWM)", "L298N Driver #1 (P1)", "ENA", "Parrot 1 Mouth / Eyes Actuator PWM Speed"),
            ("Raspberry Pi", "Pin 13", "GPIO 27", "2-Channel Relay Board", "Relay #2 IN", "Front Right Small Bird Chirp Sound Relay"),
            ("Raspberry Pi", "Pin 15", "GPIO 22", "Transistor Motor Driver", "Base / Gate", "Center Small Bird Gearmotor & Beak Driver"),
            ("Raspberry Pi", "Pin 16", "GPIO 23", "L298N Driver #1 (P1)", "IN1", "Parrot 1 Mouth Open (Normal Polarity)"),
            ("Raspberry Pi", "Pin 18", "GPIO 24", "L298N Driver #1 (P1)", "IN2", "Parrot 1 Eyes Blink (Reverse Polarity)"),
            ("Raspberry Pi", "Pin 22", "GPIO 25", "L298N Driver #1 (P1)", "IN3", "Parrot 1 Wing Flap Motor Direction 1"),
            ("Raspberry Pi", "Pin 24", "GPIO 8", "L298N Driver #1 (P1)", "IN4", "Parrot 1 Wing Flap Motor Direction 2"),
            ("Raspberry Pi", "Pin 32", "GPIO 12 (PWM)", "L298N Driver #2 (P2)", "ENA", "Parrot 2 Mouth / Eyes Actuator PWM Speed"),
            ("Raspberry Pi", "Pin 33", "GPIO 13 (PWM)", "L298N Driver #2 (P2)", "ENB", "Parrot 2 Flapping Wings Motor PWM Speed"),
            ("Raspberry Pi", "Pin 35", "GPIO 19 (PWM)", "L298N Driver #1 (P1)", "ENB", "Parrot 1 Flapping Wings Motor PWM Speed"),
            ("Raspberry Pi", "Pin 36", "GPIO 16", "L298N Driver #2 (P2)", "IN1", "Parrot 2 Mouth Open (Normal Polarity)"),
            ("Raspberry Pi", "Pin 37", "GPIO 26", "L298N Driver #2 (P2)", "IN4", "Parrot 2 Wing Flap Motor Direction 2"),
            ("Raspberry Pi", "Pin 38", "GPIO 20", "L298N Driver #2 (P2)", "IN2", "Parrot 2 Eyes Blink (Reverse Polarity)"),
            ("Raspberry Pi", "Pin 40", "GPIO 21", "L298N Driver #2 (P2)", "IN3", "Parrot 2 Wing Flap Motor Direction 1"),
            ("PCA9685 PWM", "Ch 0 - 2", "PWM Servo Out", "Parrot 1 (Left) 3-DOF", "Servos", "Base Turn (Yaw), Bow (Pitch), Shimmy (Roll)"),
            ("PCA9685 PWM", "Ch 3 - 5", "PWM Servo/LED", "Parrot 1 Spotlight", "Servos & LED", "Spotlight Pan, Tilt & LED Intensity Dimmer"),
            ("PCA9685 PWM", "Ch 6 - 8", "PWM Servo Out", "Parrot 2 (Right) 3-DOF", "Servos", "Base Turn (Yaw), Bow (Pitch), Shimmy (Roll)"),
            ("PCA9685 PWM", "Ch 9 - 11", "PWM Servo/LED", "Parrot 2 Spotlight", "Servos & LED", "Spotlight Pan, Tilt & LED Intensity Dimmer"),
            ("PCA9685 PWM", "Ch 12 - 14", "PWM Servo Out", "Center Small Bird 3-DOF", "Servos", "Base Turn (Yaw), Bow (Pitch), Shimmy (Roll)"),
            ("PCA9685 PWM", "Ch 15", "PWM Servo Out", "Main Stage Turntable", "Base Servo", "Whole Stage Rotating Turntable Base Servo"),
            ("Power Rail", "+5V / +6V", "DC Power", "PCA9685 V+ & L298N 12V", "Terminals", "High-Current 12A Servo & Gearmotor Power Rail"),
            ("Power Rail", "GND Bus", "Common Ground", "All Board GND Terminals", "GND Bus", "Shared Common Reference Ground Bus")
        ]

        for item in pinout_data_items:
            pinout_rows.append([
                Paragraph(f"<b>{item[0]}</b>", cell_style),
                Paragraph(f"<b>{item[1]}</b>", cell_style),
                Paragraph(f"<code>{item[2]}</code>", cell_style),
                Paragraph(item[3], cell_style),
                Paragraph(item[4], cell_style),
                Paragraph(item[5], cell_style)
            ])

        t_pinout = Table(pinout_rows, colWidths=[90, 65, 95, 125, 85, 260])
        t_pinout.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0055a5')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#dddddd')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafd')])
        ]))
        story.append(t_pinout)

        doc.build(story)
        return buffer.getvalue()

class ThreadingReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    for i in range(1, len(sys.argv)):
        if sys.argv[i] == "--port" and i + 1 < len(sys.argv):
            PORT = int(sys.argv[i + 1])
        elif sys.argv[i] == "--host" and i + 1 < len(sys.argv):
            HOST = sys.argv[i + 1]

    display_host = "localhost" if HOST in ["", "0.0.0.0", "127.0.0.1"] else HOST
    print(f"Starting Animatronic Bird Show Master Server on http://{display_host}:{PORT}")
    bind_host = "" if HOST == "0.0.0.0" else HOST
    with ThreadingReusableTCPServer((bind_host, PORT), BirdShowRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
