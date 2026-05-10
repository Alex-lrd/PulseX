// Test moteur

#include <Servo.h>

Servo myservo;

const int servoPin = 9;
const int stepAngle = 5;
const int stepDelay = 30;

void setup() {
  myservo.attach(servoPin);
  myservo.write(0);
  delay(500);
}

void loop() {
  // Aller de 0 à 180 degrés
  for (int i = 0; i <= 180; i += stepAngle) {
    myservo.write(i);
    delay(stepDelay); 
  }
  
  // Retour de 180 à 0 degrés
  for (int i = 180; i >= 0; i -= stepAngle) {
    myservo.write(i);
    delay(stepDelay);
  }
}