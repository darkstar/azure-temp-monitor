/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);

  // A class for holding the last N points of telemetry for a device
  class DeviceData {
    constructor(deviceId) {
      this.deviceId = deviceId;
      this.maxLen = 50;
      this.timeData = new Array(this.maxLen);
      this.sensor1temperatureData = new Array(this.maxLen);
      this.cputemperatureData = new Array(this.maxLen);
      this.pressureData = new Array(this.maxLen);
    }

    addData(time, sensortemperature, cputemperature, pressure) {
      this.timeData.push(time);
      this.sensor1temperatureData.push(sensortemperature);
      this.cputemperatureData.push(cputemperature);
      this.pressureData.push(pressure || null);

      if (this.timeData.length > this.maxLen) {
        this.timeData.shift();
        this.sensor1temperatureData.shift();
        this.cputemperatureData.shift();
        this.pressureData.shift();
      }
    }
  }

  // All the devices in the list (those that have been sending telemetry)
  class TrackedDevices {
    constructor() {
      this.devices = [];
    }

    // Find a device based on its Id
    findDevice(deviceId) {
      for (let i = 0; i < this.devices.length; ++i) {
        if (this.devices[i].deviceId === deviceId) {
          return this.devices[i];
        }
      }

      return undefined;
    }
  }

  const trackedDevices = new TrackedDevices();

  // Define the chart axes
  const chartData = {
    datasets: [
      {
        fill: false,
        label: 'Sensor Temperature',
        yAxisID: 'Temperature',
        borderColor: 'rgba(255, 204, 0, 1)',
        pointBoarderColor: 'rgba(255, 204, 0, 1)',
        backgroundColor: 'rgba(255, 204, 0, 0.4)',
        pointHoverBackgroundColor: 'rgba(255, 204, 0, 1)',
        pointHoverBorderColor: 'rgba(255, 204, 0, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'CPU Temperature',
        yAxisID: 'Temperature',
        borderColor: 'rgba(255, 102, 0, 1)',
        pointBoarderColor: 'rgba(255, 102, 0, 1)',
        backgroundColor: 'rgba(255, 102, 0, 0.4)',
        pointHoverBackgroundColor: 'rgba(255, 102, 0, 1)',
        pointHoverBorderColor: 'rgba(255, 102, 0, 1)',
        spanGaps: true,
      },
      {
        fill: false,
        label: 'Pressure',
        yAxisID: 'Pressure',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.4)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      }
    ]
  };

  const chartOptions = {
    title: {
      display: true,
      text: 'Temperature & Pressure Real-time Data',
      fontSize: 36,
    },
    scales: {
      yAxes: [{
        id: 'Temperature',
        type: 'linear',
        scaleLabel: {
          labelString: 'Temperature (ºC)',
          display: true,
        },
        position: 'left',
      },
      {
        id: 'Pressure',
        type: 'linear',
        scaleLabel: {
          labelString: 'Pressure (hPa)',
          display: true,
        },
        position: 'right',
      }]
    }
  };

  // Get the context of the canvas element we want to select
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });

  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  const listOfDevices = document.getElementById('listOfDevices');
  function OnSelectionChange() {
    const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
    chartData.labels = device.timeData;
    chartData.datasets[0].data = device.sensor1temperatureData;
    chartData.datasets[1].data = device.cputemperatureData;
    chartData.datasets[2].data = device.pressureData;
  }
  listOfDevices.addEventListener('change', OnSelectionChange, false);

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and temperature
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData);

      // time and temperature are required
      if (!messageData.MessageDate || !messageData.IotData.sensor1temp) {
        return;
      }

      // find or add device to list of tracked devices
      const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

      if (existingDeviceData) {
        existingDeviceData.addData(messageData.MessageDate, messageData.IotData.sensor1temp, messageData.IotData.cputemp, messageData.IotData.pressure);
      } else {
        const newDeviceData = new DeviceData(messageData.DeviceId);
        trackedDevices.devices.push(newDeviceData);
        newDeviceData.addData(messageData.MessageDate, messageData.IotData.sensor1temp, messageData.IotData.cputemp, messageData.IotData.pressure);

        // add device to the UI list
        const node = document.createElement('option');
        const nodeText = document.createTextNode(messageData.DeviceId);
        node.appendChild(nodeText);
        listOfDevices.appendChild(node);

        // if this is the first device being discovered, auto-select it
        if (listOfDevices.selectedIndex === -1) {
          listOfDevices.selectedIndex = 0;
          OnSelectionChange();
        }
      }

      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});