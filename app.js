"use strict";

const Homey = require("homey");
const HomeyAPI = require("athom-api").HomeyAPI;
// const flowActions = require('./lib/flows/actions');
// const flowTriggers = require('./lib/flows/triggers');
const _settingsKey = `${Homey.manifest.id}.settings`;

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);
  }

  // -------------------- INIT ----------------------

  async onInit() {
    this.log(`${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

    await this.initSettings();

    this.log("[onInit] - Loaded settings", this.appSettings);

    this._api = await HomeyAPI.forCurrentHomey(this.homey);
    
    // await flowTriggers.init(this.homey);

    await this.findFlowDefects();
    await this.setFindFlowsInterval();
  }

  // -------------------- SETTINGS ----------------------

  async initSettings() {
    try {
      let settingsInitialized = false;
      this.homey.settings.getKeys().forEach((key) => {
        if (key == _settingsKey) {
          settingsInitialized = true;
        }
      });

      if (settingsInitialized) {
        this.log("[initSettings] - Found settings key", _settingsKey);
        this.appSettings = this.homey.settings.get(_settingsKey);
      } else {
        this.log(`Initializing ${_settingsKey} with defaults`);
        await this.updateSettings({
          BROKEN: [],
          DISABLED: [],
          NOTIFICATION_BROKEN: true,
          NOTIFICATION_DISABLED: false
        });
      }
    } catch (err) {
      this.error(err);
    }
  }

  async updateSettings(settings) {
    try {
      this.log("[updateSettings] - New settings:", settings);
      this.appSettings = settings;
      
      await this.homey.settings.set(_settingsKey, this.appSettings);  
    } catch (error) {
      this.error(err);
    }
  }

// -------------------- FUNCTIONS ----------------------

    async setFindFlowsInterval(REFRESH = 1) {
      const REFRESH_INTERVAL = 1000 * (REFRESH * 60);

      this.log(`[onPollInterval]`, REFRESH, REFRESH_INTERVAL);
      this.onPollInterval = setInterval(this.findFlowDefects.bind(this), REFRESH_INTERVAL);
    }
  
    async findFlowDefects() {
      try {
        await this.findFlows('BROKEN');
        await this.findFlows('DISABLED');
      } catch (error) {
        this.error(error);
      }
    }

    async findFlows(key) {
        const flowArray = this.appSettings[key];

        this.log(`[findFlows] ${key} - FlowArray: `, flowArray);
        let flows = [];

        if(key === 'BROKEN') {
          flows = Object.values(await this._api.flow.getFlows({ filter: { broken: true } }));
        } else if(key === 'DISABLED') {
          flows = Object.values(await this._api.flow.getFlows({ filter: { enabled: false } }));
        }
    
        if (flowArray.length !== flows.length) {
          await this.updateSettings({...this.appSettings, [key]: [...new Set(flows.map((f) => f.name))]});
          await this.checkFlowDiff(key, flows, flowArray);
        }
    }

    async checkFlowDiff(key, flows, flowArray) {
      try {
        const flowDiff = flows.filter(x => !flowArray.includes(x));

        this.log(`[flowDiff] ${key} - flowDiff: `, flowDiff.length);
  
        if(flowDiff.length) {
          flowDiff.forEach(flow =>  {
            this.homey.flow.getTriggerCard(`trigger_${key}`).trigger({flow: flow.name, id: flow.id})
                .catch( this.error )
                .then(this.log(`[flowDiff] ${key} - Triggered: "${flow.name} | ${flow.id}"`)); 
  
           this.setNotification(key, flow.name);
          });
        }
      } catch (error) {
        this.error(error);
      }
     
    }

    async setNotification(key, flow, type) {
      try {
        if(this.appSettings[`NOTIFICATION_${key}`]);
        await this.homey.notifications.createNotification({
          excerpt: `[FlowChecker] - Event: ${key} - Flow: ${flow}`,
        });
      } catch (error) {
        this.error(error);
      }
    }
}

module.exports = App;
