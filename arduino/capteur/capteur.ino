// Test capteur

bool scan = false;
float propagation = .0343;

// --- CAPTEUR 1 (A) ---
const int trigPinA = A0;  
const int echoPinA = A1;

// --- CAPTEUR 2 (B) ---
const int trigPinB = A2;  // Branche le Trig du 2ème capteur sur A2
const int echoPinB = A3;  // Branche l'Echo du 2ème capteur sur A3

const int SAMPLES = 5; // Nombre de lectures pour la moyenne

void setup() {
  Serial.begin(9600);
  
   // Configuration Capteur A
   pinMode(trigPinA, OUTPUT);  
   pinMode(echoPinA, INPUT); 
  
  // Configuration Capteur B
  pinMode(trigPinB, OUTPUT);  
  pinMode(echoPinB, INPUT); 

  delay(2000);
  Serial.println("PulseX Ready (2 Sensors - Filtered) !!!");
}

// La fonction accepte maintenant les pins en paramètres
float getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);  
  delayMicroseconds(2);  
  digitalWrite(trigPin, HIGH);  
  delayMicroseconds(10);  
  digitalWrite(trigPin, LOW); 

  // Timeout de 30ms (environ 5 mètres max de portée théorique)
  long duration = pulseIn(echoPin, HIGH, 30000); 
  
  if (duration == 0) return 0; // Pas d'obstacle ou trop loin
  
  return (duration * propagation) / 2;
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "start") scan = true;
    else if (cmd == "stop") scan = false;
  }

  if (scan) {
    // Variables pour Capteur A
    float sumA = 0;
    int validSamplesA = 0;

    // Variables pour Capteur B
    float sumB = 0;
    int validSamplesB = 0;

    for (int i = 0; i < SAMPLES; i++) {
      // Lecture Capteur A
      float dA = getDistance(trigPinA, echoPinA);
      if (dA > 0.1 && dA < 400.0) {
        sumA += dA;
        validSamplesA++;
      }
      delay(10); // Pause pour éviter que l'écho du capteur A perturbe le B

      // Lecture Capteur B
      float dB = getDistance(trigPinB, echoPinB);
      if (dB > 0.1 && dB < 400.0) {
        sumB += dB;
        validSamplesB++;
      }
      delay(10); // Pause avant la prochaine salve
    }

    // Envoi des données si elles sont valides
    if (validSamplesA > 0 || validSamplesB > 0) {
      float avgA = (validSamplesA > 0) ? (sumA / validSamplesA) : -1.0; // -1.0 si erreur de lecture
      float avgB = (validSamplesB > 0) ? (sumB / validSamplesB) : -1.0;

      // Envoi au format : "DistanceA,DistanceB" (Pratique pour parser sur une appli web ou Python)
      Serial.print(avgA);
      Serial.print(",");
      Serial.println(avgB);
    }
  }
}