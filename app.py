# from flask import Flask, render_template, jsonify
# import threading
# import serial
# import time
# import queue
# 
# app = Flask(__name__)
# 
# # ---------------- SERIAL ----------------
# ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=0.1)
# time.sleep(2)
# ser.reset_input_buffer()
# ser.reset_output_buffer()
# 
# scan = False # Double securite (eviter d'avoir un log apres une commande)
# 
# write_queue = queue.Queue()
# latest_distance = None
# latest_time = 0
# 
# # ---------------- SERIAL THREAD ----------------
# def serial_worker():
#     global latest_distance, latest_time, scan
#     buffer = ""
# 
#     while True:
#         # 1. Écrire les commandes en attente
#         while not write_queue.empty():
#             cmd = write_queue.get_nowait()
#             ser.reset_input_buffer()
#             time.sleep(0.05)
#             ser.write(cmd)
#             ser.flush()
# 
#         # 2. Lire ce qui est disponible
#         try:
#             data = ser.read(ser.in_waiting or 1)
#             if data:
#                 buffer += data.decode('utf-8', errors='ignore')
#                 while '\n' in buffer:
#                     line, buffer = buffer.split('\n', 1)
#                     line = line.strip()
#                     if not line:
#                         continue
# 
#                     print(f"ARDUINO: {line}")
# 
#                     # Message de démarrage
#                     # if line == "PulseX Ready !!!":
#                     #     print("LOG: Arduino prêt")
# 
#                     # Commandes echo (RECU:start / RECU:stop)
#                     # if line.startswith("RECU:"):
#                     #     print(f"LOG: Arduino a reçu : {line[5:]}")
# 
#                     # Distance brute (float sans préfixe)
#                     # else:
#                     if not line.startswith("RECU:") and scan:
#                         try:
#                             val = float(line)
#                             if val > 0:
#                                 latest_distance = val
#                                 latest_time = time.time()
#                         except ValueError:
#                             print(f"LOG: Message inconnu : {line}")
# 
#         except Exception as e:
#             print(f"Serial error: {e}")
# 
#         time.sleep(0.01)
# 
# worker_thread = threading.Thread(target=serial_worker, daemon=True)
# worker_thread.start()
# 
# # ---------------- ROUTES ----------------
# @app.route("/")
# def index():
#     return render_template("index.html")
# 
# @app.route("/api/start")
# def start():
#     global scan
#     write_queue.put(b"start\n")
#     scan = True
#     return jsonify({"status": "started"})
# 
# @app.route("/api/stop")
# def stop():
#     global scan, latest_distance, latest_time
#     write_queue.put(b"stop\n")
#     scan = False
#     latest_distance = None
#     latest_time = 0
#     return jsonify({"status": "stopped"})
# 
# @app.route("/api/distance")
# def distance():
#     return jsonify({
#         "distance": latest_distance,
#         "age": round(time.time() - latest_time, 2) if latest_time else None
#     })
# 
# # ---------------- RUN ----------------
# if __name__ == "__main__":
#     app.run(debug=True, use_reloader=False)




from flask import Flask, render_template, jsonify
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

latest = {
    "angle": None,
    "d1": None,
    "d2": None,
    "time": 0
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
                    if not line or line.startswith("RECU:"):
                        continue

                    if scan:
                        parts = line.split(",")
                        if len(parts) == 3:
                            try:
                                angle = int(parts[0])
                                d1 = float(parts[1])
                                d2 = float(parts[2])
                                latest["angle"] = angle
                                latest["d1"] = d1 if d1 > 0 else None
                                latest["d2"] = d2 if d2 > 0 else None
                                latest["time"] = time.time()
                            except ValueError:
                                print(f"LOG: Parse erreur : {line}")
                        else:
                            print(f"LOG: Format inconnu : {line}")

        except Exception as e:
            print(f"Serial error: {e}")

        time.sleep(0.01)

worker_thread = threading.Thread(target=serial_worker, daemon=True)
worker_thread.start()

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
    latest.update({"angle": None, "d1": None, "d2": None, "time": 0})
    return jsonify({"status": "stopped"})

@app.route("/api/scan")
def scan_data():
    return jsonify({
        "angle": latest["angle"],
        "d1": latest["d1"],
        "d2": latest["d2"],
        "age": round(time.time() - latest["time"], 2) if latest["time"] else None
    })

# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)