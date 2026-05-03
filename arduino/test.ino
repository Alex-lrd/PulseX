bool scan = false;
float speed = 1.0;
float timePropagation = .0343;

const int trigPin = A0;  
const int echoPin = A1;
float duration, distance;  

String cmd = "";

void setup() {
  Serial.begin(9600); // Important 9600baud pas 115200 sinon corruption data
  delay(2000);

  Serial.println("PulseX Ready !!!");

  pinMode(trigPin, OUTPUT);  
	pinMode(echoPin, INPUT); 
}

void loop() {

  if (Serial.available()) {
    cmd = Serial.readStringUntil('\n');
    cmd.trim();

    Serial.print("RECU:");
    Serial.println(cmd);

    if (cmd == "start") {
      // Serial.println("OK START");
      scan = true;
    } else if (cmd == "stop") {
      // Serial.println("OK STOP");
      scan = false;
    } 
  }


  if (scan) {
    digitalWrite(trigPin, LOW);  
    delayMicroseconds(2);  
    digitalWrite(trigPin, HIGH);  
    delayMicroseconds(10);  
    digitalWrite(trigPin, LOW); 

    duration = pulseIn(echoPin, HIGH);
    distance = (duration * timePropagation) / 2;
    Serial.println(distance);
  }

}
