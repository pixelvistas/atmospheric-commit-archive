let raw;
let rows = [];
let events = [];

function preload() {
    raw = loadStrings("weather.csv");
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont("monospace");

    parseWeatherCSV();
    buildEvents();

    console.log("rows:", rows.length);
    console.log("events:", events.length);
}

function draw() {
    background(5);

    fill(255);
    noStroke();
    textSize(18);
    text("Atmospheric Commit Archive", 40, 50);
    textSize(13);
    text("events loaded: " + events.length, 40, 75);

    translate(width / 2, height / 2);
    drawArchive();
}

function parseWeatherCSV() {
    // Find actual CSV header row
    let headerIndex = raw.findIndex(line => line.startsWith("time,"));

    if (headerIndex === -1) {
        console.error("Could not find CSV header row.");
        return;
    }

    let headers = raw[headerIndex].split(",");

    for (let i = headerIndex + 1; i < raw.length; i++) {
        let line = raw[i].trim();
        if (!line) continue;

        let values = line.split(",");
        let row = {};

        headers.forEach((h, index) => {
            row[h.trim()] = values[index];
        });

        rows.push(row);
    }
}

function buildEvents() {
    for (let i = 1; i < rows.length; i++) {
        let row = rows[i];
        let prev = rows[i - 1];

        let temp = Number(row["temperature_2m (°C)"]);
        let prevTemp = Number(prev["temperature_2m (°C)"]);

        let rain = Number(row["precipitation (mm)"]);
        let prevRain = Number(prev["precipitation (mm)"]);

        let wind = Number(row["wind_speed_10m (km/h)"]);
        let humidity = Number(row["relative_humidity_2m (%)"]);
        let pressure = Number(row["surface_pressure (hPa)"]);

        let tempChange = temp - prevTemp;

        let type = "hold";

        if (rain > 0 && prevRain === 0) type = "add";
        else if (rain === 0 && prevRain > 0) type = "delete";
        else if (wind > 30) type = "merge";
        else if (abs(tempChange) > 2) type = "modify";

        let intensity =
            abs(tempChange) * 0.5 +
            rain * 2 +
            wind * 0.04 +
            abs(pressure - 1000) * 0.01;

        let instability =
            abs(tempChange) * 0.6 +
            rain * 3 +
            wind * 0.2;

        events.push({
            index: i,
            type,
            temp,
            rain,
            wind,
            humidity,
            pressure,
            intensity,
            instability
        });
    }
    console.log(events[0]);
}

function drawArchive() {
    let maxRadius = min(width, height) * 0.42;

    stroke(255, 35);
    noFill();

    for (let r = 80; r < maxRadius; r += 60) {
        circle(0, 0, r * 2);
    }

    for (let i = 1; i < events.length; i++) {
        let a = getPos(events[i - 1], maxRadius);
        let b = getPos(events[i], maxRadius);

        stroke(255, 12);
        strokeWeight(0.9);

        bezier(
            a.x, a.y,
            a.x * 0.2, a.y * 0.2,
            b.x * 0.2, b.y * 0.2,
            b.x, b.y
        );
    }

    noStroke();

    // same-type memory connections
    let lastOfType = {};

    for (let e of events) {
        if (e.type === "hold") continue;

        if (lastOfType[e.type]) {
            let a = getPos(lastOfType[e.type], maxRadius);
            let b = getPos(e, maxRadius);

            let age = e.index / events.length;
            let alpha = map(pow(age, 1.6), 0, 1, 6, 32);

            stroke(255, alpha);
            strokeWeight(0.7);
            noFill();
            bezier(
                a.x, a.y,
                a.x * 0.15, a.y * 0.15,
                b.x * 0.15, b.y * 0.15,
                b.x, b.y
            );
        }

        lastOfType[e.type] = e;
    }

    // event nodes
    for (let e of events) {
        let p = getPos(e, maxRadius);

        let intensity = e.intensity;
        if (!isFinite(intensity)) intensity = 1;

        let size = 1.5 + intensity * 0.8;

        noStroke();
        let r = 255;
        let g = 255;
        let b = 255;

        // temperature → warm/cool tint
        if (e.temp > 10) {
            r = 255;
            g = 200;
            b = 200;
        } else if (e.temp < 0) {
            r = 200;
            g = 220;
            b = 255;
        }

        // rain → blue boost
        if (e.rain > 0) {
            b = 255;
            g *= 0.8;
        }

        // wind → desaturate (grey)
        if (e.wind > 25) {
            r = g = b = 220;
        }

        // older events are dimmer, newer events are brighter
        let age = e.index / events.length;
        let alpha = map(pow(age, 1.6), 0, 1, 20, 170);

        fill(r, g, b, alpha);
        circle(p.x, p.y, size);
    }

    // emphasized weather events
    for (let e of events) {
        if (e.type === "hold") continue;

        let p = getPos(e, maxRadius);

        let bigSize = 12;

        if (e.type === "add") bigSize = 28;
        if (e.type === "delete") bigSize = 20;
        if (e.type === "modify") bigSize = 18;
        if (e.type === "merge") bigSize = 45;

        noStroke();
        fill(255, 90);
        circle(p.x, p.y, bigSize);

        let a = atan2(p.y, p.x);

        let startR = maxRadius * 0.08;
        let midR = maxRadius * 0.65;
        let endR = maxRadius * 0.92;

        // instability controls how much the curve bends
        let wobble = map(e.instability, 0, 10, 0.1, 0.6, true);

        let start = {
            x: cos(a - wobble) * startR,
            y: sin(a - wobble) * startR
        };

        let c1 = {
            x: cos(a - wobble) * midR,
            y: sin(a - wobble) * midR
        };

        let c2 = {
            x: cos(a + wobble * 0.5) * endR,
            y: sin(a + wobble * 0.5) * endR
        };

        let age = e.index / events.length;
        let alpha = map(pow(age, 1.6), 0, 1, 12, 70);

        stroke(255, alpha);
        strokeWeight(0.9);
        noFill();

        bezier(
            start.x, start.y,
            c1.x, c1.y,
            c2.x, c2.y,
            p.x, p.y
        );

        // faint atmospheric core
        noStroke();

        for (let i = 0; i < 80; i++) {
            let a = random(TWO_PI);
            let r = random(maxRadius * 0.08, maxRadius * 0.22);

            fill(255, 8);
            circle(cos(a) * r, sin(a) * r, random(1, 3));
        }

        // outer timeline ticks
        let outerR = maxRadius * 1.02;

        for (let i = 0; i < events.length; i++) {
            let angle = map(i, 0, events.length, -HALF_PI, TWO_PI - HALF_PI);

            let e = events[i];

            let tickLength = 4;

            if (e.type === "add") tickLength = 10;
            if (e.type === "delete") tickLength = 8;
            if (e.type === "modify") tickLength = 6;
            if (e.type === "merge") tickLength = 14;

            let x1 = cos(angle) * outerR;
            let y1 = sin(angle) * outerR;

            let x2 = cos(angle) * (outerR + tickLength);
            let y2 = sin(angle) * (outerR + tickLength);

            stroke(255, 80);
            strokeWeight(1);

            line(x1, y1, x2, y2);
        }
    }

    stroke(255, 100);
    strokeWeight(0.8);
    noFill();
    circle(0, 0, maxRadius * 2);
}

function getPos(e, maxRadius) {
    let angle = map(e.index, 0, events.length, -HALF_PI, TWO_PI - HALF_PI);

    let intensity = e.intensity;
    if (!isFinite(intensity)) intensity = 1;

    let n = constrain(intensity / 20, 0, 1);

    // invert the mapping:
    // low intensity = outer field
    // high intensity = inner/mid highlight
    let curved = pow(1 - n, 0.6);

    let r = maxRadius * (0.25 + curved * 0.7);

    return {
        x: cos(angle) * r,
        y: sin(angle) * r
    };
}