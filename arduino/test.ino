void setup() {
  Serial.begin(9600);
}

void loop() {
  // Envoyer une donnée
  Serial.println("Bonjour depuis Arduino !");
  delay(1000);

  // Lire ce que Python envoie
  if (Serial.available() > 0) {
    String data = Serial.readStringUntil('\n');
    Serial.print("Reçu : ");
    Serial.println(data);
  }
}