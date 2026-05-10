from flask import Flask, render_template, jsonify, request
import threading
import serial
import time
import queue

app = Flask(__name__)

# ---------------- SERIAL ----------------
ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=0.1)
time.sleep(2)
ser.reset_input_buffer()
ser.reset_output_buffer()

scan = False
write_queue = queue.Queue()

latest_data = {
    "angle": None,
    "d1": None,
    "d2": None,
    "time": 0,
    "speed": 50,             # Valeur par défaut
    "propagation": 0.0343    # Valeur par défaut
}

# ---------------- SERIAL THREAD ----------------
def serial_worker():
    global scan
    buffer = ""

    while True:
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

                    # On attrape les réponses système de l'Arduino pour mettre à jour Flask
                    if line.startswith("RECU:speed") or line.startswith("INFO:speed"):
                        latest_data["speed"] = int(line.split()[1])
                    elif line.startswith("RECU:propagation") or line.startswith("INFO:propagation"):
                        latest_data["propagation"] = float(line.split()[1])
                        
                    elif not line.startswith("RECU:") and not line.startswith("INFO:") and scan:
                        parts = line.split(",")
                        if len(parts) == 3:
                            try:
                                angle = int(parts[0])
                                val1 = float(parts[1])
                                val2 = float(parts[2])
                                
                                latest_data["angle"] = angle
                                latest_data["d1"] = val1 if val1 > 0 else None
                                latest_data["d2"] = val2 if val2 > 0 else None
                                latest_data["time"] = time.time()
                            except ValueError:
                                pass

        except Exception as e:
            print(f"Serial error: {e}")

        time.sleep(0.01)

worker_thread = threading.Thread(target=serial_worker, daemon=True)
worker_thread.start()

# Demande initiale à l'Arduino pour synchroniser les valeurs par défaut
write_queue.put(b"speed_get\n")
write_queue.put(b"propagation_get\n")

# ---------------- ROUTES ----------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/start")
def start():
    global scan
    write_queue.put(b"start\n")
    scan = True
    return jsonify({"status": "started"})

@app.route("/api/stop")
def stop():
    global scan
    write_queue.put(b"stop\n")
    scan = False
    latest_data.update({"angle": None, "d1": None, "d2": None, "time": 0})
    return jsonify({"status": "stopped"})

@app.route("/api/distance")
def distance():
    age = round(time.time() - latest_data["time"], 2) if latest_data["time"] else None
    return jsonify({
        "angle": latest_data["angle"],
        "d1": latest_data["d1"],
        "d2": latest_data["d2"],
        "age": age
    })

# --- NOUVELLES ROUTES ---

@app.route("/api/speed", methods=["GET", "POST"])
def speed():
    if request.method == "POST":
        val = request.json.get("value")
        if val is not None:
            write_queue.put(f"speed {val}\n".encode())
            return jsonify({"status": "updating", "value": val})
    return jsonify({"speed": latest_data["speed"]})

@app.route("/api/propagation", methods=["GET", "POST"])
def propagation():
    if request.method == "POST":
        val = request.json.get("value")
        if val is not None:
            write_queue.put(f"propagation {val}\n".encode())
            return jsonify({"status": "updating", "value": val})
    return jsonify({"propagation": latest_data["propagation"]})

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)