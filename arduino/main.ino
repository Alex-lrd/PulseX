
#include <Servo.h>

bool scan = false;
float propagation = 0.0343;

// --- CONFIGURATION SERVO ---
Servo myServo;
const int servoPin = 9;  
int angle = 0;
int stepDir = 5;         
int stepDelay = 80;      

// --- CAPTEURS ---
const int trigPinA = A0;  
const int echoPinA = A1;
const int trigPinB = A2;  
const int echoPinB = A3;

const int SAMPLES = 3;   

void setup() {
  Serial.begin(9600);
  
  myServo.attach(servoPin);
  myServo.write(0); 
  delay(1000);
  myServo.detach(); 
  
  pinMode(trigPinA, OUTPUT);  
  pinMode(echoPinA, INPUT); 
  pinMode(trigPinB, OUTPUT);  
  pinMode(echoPinB, INPUT); 

  delay(1000);
  Serial.println("PulseX Ready (Radar 360) !!!");
}

float getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);  
  delayMicroseconds(2);  
  digitalWrite(trigPin, HIGH);  
  delayMicroseconds(10);  
  digitalWrite(trigPin, LOW); 

  long duration = pulseIn(echoPin, HIGH, 15000); 
  
  if (duration == 0) return 0;
  return (duration * propagation) / 2;
}

void loop() {
  // --- LECTURE DES COMMANDES SÉRIE ---
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    
    if (cmd == "start") {
      scan = true;
      Serial.println("RECU:start");
    } 
    else if (cmd == "stop") {
      scan = false;
      myServo.detach();
      Serial.println("RECU:stop");
    } 
    else if (cmd.startsWith("speed ")) {
      int value = cmd.substring(6).toInt();
      if (value > 0) {
        stepDelay = value;
        Serial.print("RECU:speed ");
        Serial.println(stepDelay);
      }
    } 
    else if (cmd == "speed_get") {
      Serial.print("INFO:speed ");
      Serial.println(stepDelay);
    }
    else if (cmd.startsWith("propagation ")) {
      float value = cmd.substring(12).toFloat();
      if (value > 0) {
        propagation = value;
        Serial.print("RECU:propagation ");
        Serial.println(propagation, 6);
      }
    }
    else if (cmd == "propagation_get") {
      Serial.print("INFO:propagation ");
      Serial.println(propagation, 6);
    }
  }

  // --- BALAYAGE ET CAPTURE ---
  if (scan) {
    myServo.attach(servoPin);
    myServo.write(angle);
    
    delay(stepDelay); 

    myServo.detach();
    delay(10); 

    float sumA = 0, sumB = 0;
    int validA = 0, validB = 0;

    for (int i = 0; i < SAMPLES; i++) {
      float dA = getDistance(trigPinA, echoPinA);
      if (dA > 0.1 && dA < 400.0) { sumA += dA; validA++; }
      delay(10); 

      float dB = getDistance(trigPinB, echoPinB);
      if (dB > 0.1 && dB < 400.0) { sumB += dB; validB++; }
      delay(10); 
    }

    float avgA = (validA > 0) ? (sumA / validA) : -1.0;
    float avgB = (validB > 0) ? (sumB / validB) : -1.0;

    Serial.print(angle);
    Serial.print(",");
    Serial.print(avgA);
    Serial.print(",");
    Serial.println(avgB);

    angle += stepDir;

    // --- GESTION ADOUCIE DU CHANGEMENT DE DIRECTION ---
    if (angle >= 180) {
      angle = 180;
      stepDir = -5; 
      
      myServo.attach(servoPin);
      myServo.write(180);
      delay(150);
      myServo.detach();
      delay(100);
    } 
    else if (angle <= 0) {
      angle = 0;
      stepDir = 5;  
      
      myServo.attach(servoPin);
      myServo.write(0);
      delay(150);
      myServo.detach();
      delay(100);
    }
  }
}