#define CFG_EU 1

#include <Servo.h>
#include <SPI.h>

#include <lmic.h>
#include <hal/hal.h>
// -------- TTN ABP CONFIG --------
static const u4_t DEVADDR = 0x260B2436;

static const PROGMEM u1_t NWKSKEY[16] = {
  0xBF, 0x40, 0x6C, 0x72,
  0x4E, 0x19, 0xF8, 0xE1,
  0xAC, 0xA1, 0x46, 0x75,
  0x82, 0x55, 0x19, 0x7A
};

static const u1_t PROGMEM APPSKEY[16] = {
  0x49, 0x43, 0xAB, 0xAF,
  0xCB, 0xB4, 0x7E, 0xAC,
  0x1A, 0x27, 0xF2, 0x40,
  0x4E, 0x4C, 0x5F, 0x72
};

// Required by LMIC
void os_getArtEui(u1_t* buf) {}
void os_getDevEui(u1_t* buf) {}
void os_getDevKey(u1_t* buf) {}

void do_send(osjob_t* j);

static osjob_t sendjob;

// -------- LORA PIN CONFIG --------
// Adapter selon ton module LoRa
const lmic_pinmap lmic_pins = {
  .nss = 10,
  .rxtx = LMIC_UNUSED_PIN,
  .rst = 8,
  .dio = {2, 3, 4},
};

// -------- RADAR CONFIG --------
Servo myServo;

const int servoPin = 9;

const int trigPinA = A0;
const int echoPinA = A1;

const int trigPinB = A2;
const int echoPinB = A3;

const int SAMPLES = 3;
const int STEP_DELAY_MS = 80;
const int STEP_ANGLE = 5;

const unsigned TX_INTERVAL_SECONDS = 15;
const uint8_t FPORT_RADAR = 1;

float propagation = 0.0343f;

int angle = 0;
int stepDir = STEP_ANGLE;

uint8_t payload[6];

// --------------------------------------------------
// DISTANCE
// --------------------------------------------------

float getDistanceCm(int trigPin, int echoPin) {

  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);

  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 15000);

  if (duration == 0) {
    return -1.0f;
  }

  float distance = (duration * propagation) / 2.0f;

  if (distance <= 0.1f || distance >= 400.0f) {
    return -1.0f;
  }

  return distance;
}

float sampleAverageDistance(int trigPin, int echoPin) {

  float sum = 0.0f;
  int valid = 0;

  for (int i = 0; i < SAMPLES; i++) {

    float value = getDistanceCm(trigPin, echoPin);

    if (value > 0.0f) {
      sum += value;
      valid++;
    }

    delay(10);
  }

  if (valid == 0) {
    return -1.0f;
  }

  return sum / valid;
}

uint16_t encodeDistance(float distanceCm) {

  if (distanceCm <= 0.0f) {
    return 0xFFFF;
  }

  float scaled = distanceCm * 10.0f;

  if (scaled > 65534.0f) {
    scaled = 65534.0f;
  }

  return (uint16_t)(scaled + 0.5f);
}

// --------------------------------------------------
// RADAR CAPTURE
// --------------------------------------------------

void captureRadarPayload() {

  myServo.attach(servoPin);

  myServo.write(angle);

  delay(STEP_DELAY_MS);

  myServo.detach();

  delay(10);

  float distanceA = sampleAverageDistance(trigPinA, echoPinA);
  float distanceB = sampleAverageDistance(trigPinB, echoPinB);

  uint16_t encodedA = encodeDistance(distanceA);
  uint16_t encodedB = encodeDistance(distanceB);

  payload[0] = 1;
  payload[1] = (uint8_t)angle;

  payload[2] = highByte(encodedA);
  payload[3] = lowByte(encodedA);

  payload[4] = highByte(encodedB);
  payload[5] = lowByte(encodedB);

  Serial.print(F("RADAR angle="));
  Serial.print(angle);

  Serial.print(F(" d1="));
  Serial.print(distanceA);

  Serial.print(F(" d2="));
  Serial.println(distanceB);

  angle += stepDir;

  if (angle >= 180) {
    angle = 180;
    stepDir = -STEP_ANGLE;
  }
  else if (angle <= 0) {
    angle = 0;
    stepDir = STEP_ANGLE;
  }
}

// --------------------------------------------------
// LMIC EVENTS
// --------------------------------------------------

void onEvent(ev_t ev) {

  switch (ev) {

    case EV_TXCOMPLETE:

      Serial.println(F("EV_TXCOMPLETE"));

      os_setTimedCallback(
        &sendjob,
        os_getTime() + sec2osticks(TX_INTERVAL_SECONDS),
        do_send
      );

      break;

    case EV_JOIN_FAILED:

      Serial.println(F("EV_JOIN_FAILED"));
      break;

    default:
      break;
  }
}

// --------------------------------------------------
// SEND
// --------------------------------------------------

void do_send(osjob_t* j) {

  if (LMIC.opmode & OP_TXRXPEND) {

    Serial.println(F("OP_TXRXPEND, uplink skipped"));
    return;
  }

  captureRadarPayload();

  LMIC_setTxData2(
    FPORT_RADAR,
    payload,
    sizeof(payload),
    0
  );

  Serial.println(F("Radar payload queued"));
}

// --------------------------------------------------
// TTN SESSION
// --------------------------------------------------

void setupSession() {

#ifdef PROGMEM

  uint8_t appskey[sizeof(APPSKEY)];
  uint8_t nwkskey[sizeof(NWKSKEY)];

  memcpy_P(appskey, APPSKEY, sizeof(APPSKEY));
  memcpy_P(nwkskey, NWKSKEY, sizeof(NWKSKEY));

  LMIC_setSession(
    0x1,
    DEVADDR,
    nwkskey,
    appskey
  );

#else

  LMIC_setSession(
    0x1,
    DEVADDR,
    NWKSKEY,
    APPSKEY
  );

#endif
}

// --------------------------------------------------
// EU868 CHANNELS
// --------------------------------------------------

void setupChannels() {

#if defined(CFG_EU)

  LMIC_setupChannel(
    0,
    868100000,
    DR_RANGE_MAP(DR_SF12, DR_SF7),
    BAND_CENTI
  );

  LMIC_setupChannel(
    1,
    868300000,
    DR_RANGE_MAP(DR_SF12, DR_SF7B),
    BAND_CENTI
  );

  LMIC_setupChannel(
    2,
    868500000,
    DR_RANGE_MAP(DR_SF12, DR_SF7),
    BAND_CENTI
  );

#endif
}

// --------------------------------------------------
// SETUP
// --------------------------------------------------

void setup() {

  Serial.begin(115200);

  Serial.println(F("PulseX TTN Radar starting"));

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

  LMIC_setClockError(
    MAX_CLOCK_ERROR * 2 / 100
  );

  setupSession();

  setupChannels();

  LMIC_setLinkCheckMode(0);

  LMIC.dn2Dr = DR_SF9;

  LMIC_setDrTxpow(
    DR_SF9,
    20
  );

  do_send(&sendjob);
}

// --------------------------------------------------
// LOOP
// --------------------------------------------------

void loop() {
  os_runloop_once();
}