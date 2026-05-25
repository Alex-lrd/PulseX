import base64
import os
import queue
import threading
import time

from flask import Flask, jsonify, render_template, request

try:
    import serial
except ImportError:
    serial = None

app = Flask(__name__)

# ---------------- CONFIG ----------------
SERIAL_PORT = os.getenv("PULSEX_SERIAL_PORT", "/dev/ttyUSB0")
BAUDRATE = int(os.getenv("PULSEX_BAUDRATE", "9600"))
INPUT_MODE = os.getenv("PULSEX_INPUT_MODE", "serial").lower()
WEBHOOK_TOKEN = os.getenv("PULSEX_WEBHOOK_TOKEN")

SERIAL_ENABLED = INPUT_MODE in {"serial", "hybrid"}
WEBHOOK_ENABLED = INPUT_MODE in {"ttn", "webhook", "hybrid"}

scan = False
write_queue = queue.Queue()
ser = None

latest_data = {
    "angle": None,
    "d1": None,
    "d2": None,
    "time": 0,
    "speed": 50,             # Valeur par défaut
    "propagation": 0.0343,   # Valeur par défaut
    "max_distance": 200.0,
    "source": None,
}

def set_latest_measurement(angle, d1, d2, source):
    latest_data["angle"] = angle
    latest_data["d1"] = d1 if d1 and d1 > 0 else None
    latest_data["d2"] = d2 if d2 and d2 > 0 else None
    latest_data["time"] = time.time()
    latest_data["source"] = source


def parse_serial_line(line):
    if line.startswith("RECU:speed") or line.startswith("INFO:speed"):
        latest_data["speed"] = int(line.split()[1])
        return

    if line.startswith("RECU:propagation") or line.startswith("INFO:propagation"):
        latest_data["propagation"] = float(line.split()[1])
        return

    if line.startswith("RECU:") or line.startswith("INFO:") or not scan:
        return

    parts = line.split(",")
    if len(parts) != 3:
        return

    try:
        angle = int(parts[0])
        d1 = float(parts[1])
        d2 = float(parts[2])
    except ValueError:
        return

    set_latest_measurement(angle, d1, d2, "serial")


def init_serial():
    global ser
    if not SERIAL_ENABLED:
        return

    if serial is None:
        raise RuntimeError("pyserial n'est pas installe mais le mode serie est active")

    ser = serial.Serial(SERIAL_PORT, BAUDRATE, timeout=0.1)
    time.sleep(2)
    ser.reset_input_buffer()
    ser.reset_output_buffer()


def serial_worker():
    buffer = ""

    while True:
        if ser is None:
            time.sleep(0.2)
            continue

        while not write_queue.empty():
            cmd = write_queue.get_nowait()
            ser.reset_input_buffer()
            time.sleep(0.05)
            ser.write(cmd)
            ser.flush()

        try:
            data = ser.read(ser.in_waiting or 1)
            if data:
                buffer += data.decode('utf-8', errors='ignore')
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    line = line.strip()
                    if not line:
                        continue

                    print(f"ARDUINO: {line}")
                    parse_serial_line(line)

        except Exception as e:
            print(f"Serial error: {e}")

        time.sleep(0.01)

try:
    init_serial()
except Exception as exc:
    print(f"Serial init error: {exc}")
    ser = None

worker_thread = threading.Thread(target=serial_worker, daemon=True)
worker_thread.start()

if ser is not None:
    write_queue.put(b"speed_get\n")
    write_queue.put(b"propagation_get\n")


def serial_command_available():
    return ser is not None


def require_webhook_auth():
    if not WEBHOOK_TOKEN:
        return True

    bearer = request.headers.get("Authorization", "")
    if bearer == f"Bearer {WEBHOOK_TOKEN}":
        return True

    return request.args.get("token") == WEBHOOK_TOKEN


def decode_ttn_radar_payload(raw_payload):
    payload = base64.b64decode(raw_payload)
    if len(payload) < 6:
        raise ValueError("payload too short")

    version = payload[0]
    if version != 1:
        raise ValueError(f"unsupported payload version {version}")

    angle = payload[1]
    d1_raw = int.from_bytes(payload[2:4], byteorder="big", signed=False)
    d2_raw = int.from_bytes(payload[4:6], byteorder="big", signed=False)

    d1 = None if d1_raw == 0xFFFF else d1_raw / 10.0
    d2 = None if d2_raw == 0xFFFF else d2_raw / 10.0
    return angle, d1, d2


def extract_ttn_measurement(payload):
    uplink = payload.get("uplink_message", payload)
    decoded = uplink.get("decoded_payload")

    if isinstance(decoded, dict) and {"angle", "d1", "d2"}.issubset(decoded.keys()):
        angle = int(decoded["angle"])
        d1 = decoded["d1"]
        d2 = decoded["d2"]
        return angle, d1, d2

    raw_payload = uplink.get("frm_payload")
    if not raw_payload:
        raise ValueError("frm_payload missing")

    return decode_ttn_radar_payload(raw_payload)

# ---------------- ROUTES ----------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/start")
def start():
    global scan
    if not serial_command_available():
        return jsonify({"status": "unavailable", "reason": "serial disabled"}), 409
    write_queue.put(b"start\n")
    scan = True
    return jsonify({"status": "started"})

@app.route("/api/stop")
def stop():
    global scan
    if not serial_command_available():
        return jsonify({"status": "unavailable", "reason": "serial disabled"}), 409
    write_queue.put(b"stop\n")
    scan = False
    latest_data.update({"angle": None, "d1": None, "d2": None, "time": 0, "source": None})
    return jsonify({"status": "stopped"})

@app.route("/api/distance")
def distance():
    age = round(time.time() - latest_data["time"], 2) if latest_data["time"] else None
    return jsonify({
        "angle": latest_data["angle"],
        "d1": latest_data["d1"],
        "d2": latest_data["d2"],
        "age": age,
        "maxDistance": latest_data["max_distance"],
        "source": latest_data["source"],
    })

@app.route("/api/speed", methods=["GET", "POST"])
def speed():
    if request.method == "POST":
        if not serial_command_available():
            return jsonify({"status": "unavailable", "reason": "serial disabled"}), 409
        val = request.json.get("value")
        if val is not None:
            write_queue.put(f"speed {val}\n".encode())
            return jsonify({"status": "updating", "value": val})
    return jsonify({"speed": latest_data["speed"]})

@app.route("/api/propagation", methods=["GET", "POST"])
def propagation():
    if request.method == "POST":
        if not serial_command_available():
            return jsonify({"status": "unavailable", "reason": "serial disabled"}), 409
        val = request.json.get("value")
        if val is not None:
            write_queue.put(f"propagation {val}\n".encode())
            return jsonify({"status": "updating", "value": val})
    return jsonify({"propagation": latest_data["propagation"]})

@app.route("/api/distance-config", methods=["GET", "POST"])
def distance_config():
    if request.method == "POST":
        val = request.json.get("value")
        if val is not None:
            latest_data["max_distance"] = float(val)
            return jsonify({"status": "updated", "value": latest_data["max_distance"]})
    return jsonify({"distance": latest_data["max_distance"]})


@app.route("/api/ttn/webhook", methods=["POST"])
def ttn_webhook():
    global scan

    if not WEBHOOK_ENABLED:
        return jsonify({"status": "disabled", "reason": "webhook disabled"}), 409

    if not require_webhook_auth():
        return jsonify({"status": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}

    try:
        angle, d1, d2 = extract_ttn_measurement(payload)
    except (ValueError, TypeError, KeyError) as exc:
        return jsonify({"status": "error", "reason": str(exc)}), 400

    scan = True
    set_latest_measurement(angle, d1, d2, "ttn")
    return jsonify({"status": "ok", "angle": angle, "d1": d1, "d2": d2})

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
