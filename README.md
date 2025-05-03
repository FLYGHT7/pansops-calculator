# pansops-calculator

# Aviation Calculators Suite ✈️

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

An opensource PANS OPS web interface for doing calculations that normally you would have on a spreadsheet. This comprehensive collection of aviation calculation tools is designed for aviation professionals, flight planners, and pilots, providing accurate calculations for various aviation parameters essential for flight planning and navigation.

**Live Demo:** [https://flyght7.com/webapp/Main.html](https://flyght7.com/webapp/Main.html)

**GitHub Repository:** [https://github.com/FLYGHT7/pansops-calculator](https://github.com/FLYGHT7/pansops-calculator)

## ⚠️ Disclaimer

**Note:** This code is in development and provided as is, it may contain errors and you are solely responsible for using it. Any feedback is welcome. The implementation is done in a projected coordinate system and currently there is no intention to use a purely geodesic calculation.

The majority of the computations are done in meters with conversion in between so slight differences may be encountered. In DOC 8168 50 ft = 15 m which is not the case and this happens for many other units.

## 🌟 Features

The Aviation Calculators Suite includes the following tools:

- **ISA Deviation Calculator**: Calculate International Standard Atmosphere deviation based on temperature and altitude
- **TAS Calculator**: Convert Indicated Airspeed (IAS) to True Airspeed (TAS) with ISA deviation considerations
- **Rate & Radius of Turn**: Calculate turn parameters based on airspeed and bank angle
- **DME Slant Range & Tolerance**: Determine DME slant range and associated tolerances
- **Profile Estimator**: Generate approach profiles with elevation calculations
- **VSS/OCS Parameters**: Calculate Visual Segment Surface and Obstacle Clearance Surface parameters
- **ILS Height Calculations**: Compute heights for Instrument Landing System approaches
- **ILS Distance Calculations**: Calculate distances for ILS approach procedures

## 📋 Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for initial loading)

## 🚀 Installation

### Option 1: Direct Use

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/FLYGHT7/pansops-calculator.git
   \`\`\`

2. Open the `Main.html` file in your web browser

### Option 2: Web Server Deployment

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/FLYGHT7/pansops-calculator.git
   \`\`\`

2. Deploy to a web server of your choice (Apache, Nginx, etc.)

3. Access through your domain or IP address

## 💻 Usage

1. Open the application in your web browser
2. Select the desired calculator from the sidebar menu
3. Enter the required parameters
4. Click the calculation button to get results
5. Use the "Save Parameters" button to save your inputs for future use
6. Use the "Load Parameters" button to reload previously saved parameters

## 🔍 Calculator Details

### ISA Deviation Calculator

Calculate the deviation from International Standard Atmosphere based on aerodrome elevation and reference temperature.

### TAS Calculator

Convert Indicated Airspeed (IAS) to True Airspeed (TAS) considering altitude and ISA deviation effects.

### Rate & Radius of Turn

Calculate the rate of turn and turn radius based on true airspeed and bank angle.

### DME Slant Range & Tolerance

Calculate the slant range distance and associated tolerances for Distance Measuring Equipment.

### Profile Estimator

Generate approach profiles with accurate elevation calculations for Final Approach Fix (FAF), Intermediate Fix (IF), and Initial Approach Fix (IAF).

### VSS/OCS Parameters

Calculate Visual Segment Surface and Obstacle Clearance Surface parameters for approach procedures.

### ILS Height & Distance Calculations

Compute heights and distances for Instrument Landing System approaches with consideration for glidepath angle and threshold crossing height.

## 🛠️ Technologies Used

- HTML5
- CSS3 with Tailwind CSS
- JavaScript (ES6+)
- SVG for dynamic diagrams

## 🌙 Dark Mode

The application includes a dark mode feature that can be toggled from the sidebar. This feature is designed to:

- Reduce eye strain in low-light environments
- Conserve battery power on mobile devices
- Provide better visibility in cockpit environments

## 📱 Responsive Design

The Aviation Calculators Suite is fully responsive and works on:

- Desktop computers
- Laptops
- Tablets
- Mobile phones

## 🔄 Data Persistence

All calculators support:

- Saving parameters as JSON files
- Loading previously saved parameters
- Copying results as formatted tables for use in reports

## 🧮 Calculation Methodology

The calculations are implemented in a projected coordinate system rather than using purely geodesic calculations. The majority of computations are performed in meters with conversions between different units as needed.

Please note that there may be slight differences in calculations due to unit conversion approximations. For example, in DOC 8168, 50 ft is equated to 15 m, which is not mathematically exact, and similar approximations occur for many other units.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- International Civil Aviation Organization (ICAO) for standardized aviation calculation methods
- Federal Aviation Administration (FAA) for approach procedure design criteria
- All contributors who have helped improve this project

## 📞 Contact

Project Link: [https://github.com/FLYGHT7/pansops-calculator](https://github.com/FLYGHT7/pansops-calculator)

---

<p align="center">
  Made with ❤️ for the aviation community
</p>
