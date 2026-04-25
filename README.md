# Renewable Design Studio

End-to-end hackathon prototype for generating residential renewable energy system designs. The app combines customer/project inputs, historical offer data, local photogrammetry models, automatic roof-capacity estimation, PV module placement, sizing logic for PV/battery/heat-pump/wallbox systems, and an editable offer summary.

## Requirements

- Python 3 (ships with macOS) — used as a local HTTP server
- A modern browser (Chrome, Firefox, Safari, Edge)

## Launch

```bash
cd hackathon
python3 -m http.server 8765
```

Then open **http://localhost:8765/viewer.html** in your browser.

> The viewer must be served over HTTP (not opened as a local file) because the browser blocks loading GLB assets from `file://` URLs.

If port 8765 is occupied, use another port:

```bash
python3 -m http.server 8766
```

Then open **http://localhost:8766/viewer.html**.

## What It Does

- Loads historical customer and offer data from `Project Data/`
- Lets an installer enter annual demand, power price, EV usage, heating type, heat demand, and house details
- Loads one of four local GLB photogrammetry models
- Detects likely roof planes from mesh geometry
- Estimates usable roof area and maximum PV module count
- Places PV modules on the detected roof planes in the 3D viewer
- Recommends PV size, battery capacity, inverter size, heat pump size, and wallbox inclusion
- Grounds recommendations against similar historical offers
- Supports installer refinement through controls and simple natural language instructions
- Produces a customer-facing offer summary

See [DATA_MODELS.md](DATA_MODELS.md) for the raw CSV schemas, normalized app models, roof-analysis model, sizing output, and offer model.

## Google Solar API Mode

The app also includes an optional Google Solar source. Add a Google API key and either an address or latitude/longitude to fetch `buildingInsights` from the Solar API. This replaces the local GLB roof-capacity estimate with live roof-segment and panel-capacity data when available.

## Controls

| Action | Input |
|--------|-------|
| Rotate | Left-click + drag |
| Zoom | Scroll wheel |
| Pan | Right-click + drag |

## Files

```
Exp 3D-Modells/          # GLB 3D models
Project Data/            # CSV project data (two datasets)
viewer.html              # Full static app (single file, no install needed)
```
