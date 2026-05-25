#define CFG_EU 1 // Europe 868MHz

#include <lmic.h>
#include <hal/hal.h>
#include <SPI.h>
#include <Servo.h>

// --- CONFIG LORAWAN ---
static const u4_t DEVADDR = 0x260B2436;

static const PROGMEM u1_t NWKSKEY[16] = { 0xBF, 0x40, 0x6C, 0x72, 0x4E, 0x19, 0xF8, 0xE1, 0xAC, 0xA1, 0x46, 0x75, 0x82, 0x55, 0x19, 0x7A };

static const u1_t PROGMEM APPSKEY[16] = { 0x49, 0x43, 0xAB, 0xAF, 0xCB, 0xB4, 0x7E, 0xAC, 0x1A, 0x27, 0xF2, 0x40, 0x4E, 0x4C, 0x5F, 0x72 };

void os_getArtEui (u1_t* buf) { }
void os_getDevEui (u1_t* buf) { }
void os_getDevKey (u1_t* buf) { }

// Format: Angle, DistA, DistB
uint8_t payloadLoRa[3] = {0, 0, 0}; 
static osjob_t sendjob;

const unsigned TX_INTERVAL = 5; // 30

// Mapping
const lmic_pinmap lmic_pins = {
    .nss = 10,
    .rxtx = LMIC_UNUSED_PIN,
    .rst = 8,
    .dio = {6, 6, 6},
};

// --- CONFIGRADAR ---
float propagation = 0.0343;
Servo myServo;
const int servoPin = 9;  
int angle = 0;
int stepDir = 5;         
int stepDelay = 80;      

const int trigPinA = A0;  
const int echoPinA = A1;
const int trigPinB = A2;  
const int echoPinB = A3;

const int SAMPLES = 3;   

// --- FONCTIONS RADAR ---
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

void executionRadar() {
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

    // Affichage
    Serial.print(angle);
    Serial.print(",");
    Serial.print(avgA);
    Serial.print(",");
    Serial.println(avgB);

    // Sauvegarde dans payload
    payloadLoRa[0] = (uint8_t)angle;
    payloadLoRa[1] = (avgA > 0) ? (uint8_t)avgA : 0;
    payloadLoRa[2] = (avgB > 0) ? (uint8_t)avgB : 0;

    angle += stepDir;

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

// --- FONCTIONS LORAWAN ---
void onEvent (ev_t ev) {
    switch(ev) {
        case EV_TXCOMPLETE:
            Serial.println(F("LoRaWAN: EV_TXCOMPLETE (Paquet envoyé)"));
            if (LMIC.txrxFlags & TXRX_ACK)
              Serial.println(F("LoRaWAN: Received ack"));
            
            // Planifie la prochaine transmission LoRa
            os_setTimedCallback(&sendjob, os_getTime()+sec2osticks(TX_INTERVAL), do_send);
            break;
         default:
            break;
    }
}

void do_send(osjob_t* j){
    // Transmission déjà en cours
    if (LMIC.opmode & OP_TXRXPEND) {
        Serial.println(F("LoRaWAN: OP_TXRXPEND, envoi reporté"));
    } else {
        // Envoie data save
        LMIC_setTxData2(1, payloadLoRa, sizeof(payloadLoRa), 0);
        Serial.println(F("LoRaWAN: Paquet radar planifié"));
    }
}

// --- SETUP & LOOP ARDUINO ---
void setup() {
    Serial.begin(115200);
    Serial.println(F("Démarrage PulseX Radar 360 + LoRaWAN..."));
    
    pinMode(trigPinA, OUTPUT);  
    pinMode(echoPinA, INPUT); 
    pinMode(trigPinB, OUTPUT);  
    pinMode(echoPinB, INPUT); 

    myServo.attach(servoPin);
    myServo.write(0); 
    delay(1000);
    myServo.detach(); 

    os_init();
    LMIC_reset();
    LMIC_setClockError(MAX_CLOCK_ERROR * 2 / 100);

    #ifdef PROGMEM
    uint8_t appskey[sizeof(APPSKEY)];
    uint8_t nwkskey[sizeof(NWKSKEY)];
    memcpy_P(appskey, APPSKEY, sizeof(APPSKEY));
    memcpy_P(nwkskey, NWKSKEY, sizeof(NWKSKEY));
    LMIC_setSession (0x1, DEVADDR, nwkskey, appskey);
    #else
    LMIC_setSession (0x1, DEVADDR, NWKSKEY, APPSKEY);
    #endif

    #if defined(CFG_EU)
    LMIC_setupChannel(0, 868100000, DR_RANGE_MAP(DR_SF12, DR_SF7),  BAND_CENTI);      
    LMIC_setupChannel(1, 868300000, DR_RANGE_MAP(DR_SF12, DR_SF7B), BAND_CENTI);      
    LMIC_setupChannel(2, 868500000, DR_RANGE_MAP(DR_SF12, DR_SF7),  BAND_CENTI);      
    #endif

    LMIC_setLinkCheckMode(0);
    LMIC.dn2Dr = DR_SF9;
    LMIC_setDrTxpow(DR_SF9, 20);

    do_send(&sendjob);
}

void loop() {
    os_runloop_once(); // Pile LoRaWAN
    
    executionRadar();
}