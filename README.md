# 🌊 HYDROBOT Simulation

A real-time flood rescue detection robot simulation using thermal imaging sensors. This project simulates the HYDROBOT system described in your research documentation - a submersible robot designed to locate victims in flooded areas using thermal imaging technology.

## Features

### 🤖 Robot Capabilities

-   **Submersible Design**: Can dive and surface using ballast tanks
-   **Thermal Imaging**: Detects heat signatures of survivors, injured victims, and deceased bodies
-   **Sonar Navigation**: Avoids debris and obstacles underwater
-   **Multi-depth Search**: Operates at surface, shallow, medium, and deep water levels
-   **Real-time Data**: Transmits detection data to rescue teams
-   **Target Collection**: Automatically rescues victims when approaching within 2 meters
-   **Interactive Rescue**: Visual collection effects with real-time feedback

### 🎥 Camera Views

-   **First-Person**: Immersive view from robot's perspective (default)
-   **Third-Person**: Follow camera behind the robot for better navigation
-   **Underwater**: Close-up following view optimized for underwater operations
-   **Thermal**: Specialized thermal imaging view
-   **Overview**: Bird's eye view for strategic planning
-   **Sonar**: Side view optimized for sonar visualization

### 🌊 Water Environment

-   **Realistic Pool Environment**: Adjustable size and depth
-   **Water Turbidity**: Simulates murky flood water conditions
-   **Floating Debris**: Obstacles that the robot must navigate around
-   **Underwater Effects**: Bubbles, currents, and realistic lighting

### 🔍 Search Patterns

1. **Surface Sweep**: Grid pattern search at water surface
2. **Spiral Dive**: Spiral pattern with gradual depth increase
3. **Depth Layers**: Systematic layer-by-layer search
4. **Debris Navigation**: Optimized path around obstacles
5. **Thermal Tracking**: Focuses on detected heat signatures

### 🎯 Heat Signature Detection & Collection

-   **Human Survivor** (37°C) - Priority 1: Immediate rescue
-   **Injured Victim** (35°C) - Priority 2: Urgent medical attention
-   **Deceased Body** (28°C) - Priority 3: Recovery operation
-   **Trapped Animal** (39°C) - Priority 4: Animal rescue
-   **Submerged Vehicle** (22°C) - Check for occupants

**Collection System**: Approach within 2 meters of any target to automatically collect it with visual effects and status updates.

## Controls

### Operation Modes

-   **Auto**: Autonomous search and rescue
-   **Manual**: Direct control (WASD + QE for depth)
-   **Rescue-Mode**: High priority victim search
-   **Deep-Search**: Extended depth search operations

### Manual Controls

-   **W/S**: Move forward/backward
-   **A/D**: Turn left/right
-   **Q/E**: Dive/surface
-   **Tab**: Toggle control panel
-   **Camera Button**: Cycle through camera views (First-Person → Third-Person → Underwater → Thermal → Overview → Sonar)

### Camera Views

-   **First-Person**: Experience the rescue from robot's perspective - perfect for immersive target collection
-   **Third-Person**: Follow behind the robot for better spatial awareness and navigation
-   **Underwater**: Optimized close-up view for underwater operations
-   **Thermal**: Specialized thermal imaging view for heat detection
-   **Overview**: Strategic bird's eye view for mission planning
-   **Sonar**: Side view optimized for sonar and obstacle visualization

### Target Collection

-   **Automatic Collection**: Approach within 2 meters of victims or debris
-   **Visual Effects**: Green flash and fade-out animation when collecting targets
-   **Real-time Updates**: Immediate feedback on rescue count and mission status
-   **Priority System**: Different targets provide different mission feedback

### Emergency Controls

-   **Emergency Dive**: Immediate descent to avoid surface hazards
-   **Emergency Surface**: Emergency ascent (low battery, malfunction)
-   **Reset Simulation**: Restart the entire simulation

## Technical Specifications

### Sensors

-   **Thermal Detection Range**: 8m (affected by water turbidity)
-   **Sonar Range**: 10m with 60 rays
-   **Maximum Dive Depth**: 6m
-   **Battery Life**: Decreases during operation

### Performance Metrics

-   **Victims Found**: Number of survivors located
-   **Area Searched**: Percentage of search area covered
-   **Heat Detection Status**: Real-time thermal scanning
-   **Battery Level**: Current power remaining
-   **Water Depth**: Current submersion level

## Research Context

This simulation is based on the HYDROBOT research project addressing flood rescue challenges in the Philippines:

### Problem Statement

-   Climate change has intensified flooding in the Philippines
-   Traditional rescue methods struggle in murky, debris-filled water
-   Zero visibility conditions make manual searches extremely difficult
-   Rescuers often don't know where to look for victims

### Solution Approach

-   Thermal imaging sensors can detect heat signatures through water
-   Submersible design allows operation in various water conditions
-   Autonomous search patterns maximize search efficiency
-   Real-time data transmission guides rescue operations

### Key Innovation

The HYDROBOT uses specially designed thermal sensors placed above the waterline but facing downward, allowing detection of heat signatures even in turbid water conditions.

## Getting Started

1. **Install Dependencies**:

    ```bash
    npm install
    ```

2. **Start Development Server**:

    ```bash
    npm run dev
    ```

3. **Open Browser**:
   Navigate to `http://localhost:5173/`

4. **Start Simulation**:
    - Choose operation mode (Auto/Manual/Rescue/Deep-Search)
    - Select search pattern
    - Adjust environment parameters
    - Watch the HYDROBOT locate victims!

## Simulation Tips

1. **Start with First-Person**: Get immersed in the rescue experience right away
2. **Switch to Third-Person**: When you need better navigation and spatial awareness
3. **Use Surface Sweep**: Good for initial reconnaissance in auto mode
4. **Manual Collection**: Drive close to victims (within 2m) to automatically rescue them
5. **Use Rescue Mode**: When you need to prioritize human survivors in auto mode
6. **Monitor Battery**: Emergency surface when battery is low
7. **Adjust Turbidity**: Higher turbidity reduces thermal detection range
8. **Watch for Debris**: Robot will automatically avoid obstacles
9. **Check Heat Signatures**: Different colors indicate different types of victims
10. **Cycle Camera Views**: Use different views for different situations (first-person for collection, overview for strategy)

## Educational Value

This simulation demonstrates:

-   Real-world robotics applications in disaster response
-   Thermal imaging technology principles
-   Autonomous navigation and path planning
-   Human-robot interaction in emergency scenarios
-   The importance of technology in saving lives
-   First-person perspective on rescue operations
-   Target acquisition and collection systems
-   Multi-perspective camera systems in robotics

## Future Enhancements

-   Water current simulation
-   Multi-robot coordination
-   Advanced AI for victim prioritization
-   Virtual reality integration
-   Real-time weather effects
-   More detailed target interaction
-   Multiplayer rescue coordination
-   Advanced debris physics

---

_Based on the HYDROBOT research project for flood rescue detection using thermal imaging sensors._
