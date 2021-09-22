"use strict";

const Homey = require("homey");
const HomeyAPI = require("athom-api").HomeyAPI;
const flowConditions = require('./lib/flows/conditions');
const flowActions = require('./lib/flows/actions');
const { sleep } = require('./lib/helpers');

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

    await flowConditions.init(this.homey);
    await flowActions.init(this.homey);

    // Prevent false positives on startup of the app. When rebooting Homey not all flows are 'working'.
    await this.setHomeyInfo();
    await this.createTokens();
    await sleep(15000);
    await this.findFlowDefects(true);
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

      this.interval = 0;

      if (settingsInitialized) {
        this.log("[initSettings] - Found settings key", _settingsKey);
        this.appSettings = this.homey.settings.get(_settingsKey);

        if(!this.appSettings.BROKEN_VARIABLE) {
            await this.updateSettings({
                ...this.appSettings,
                BROKEN_VARIABLE: [],
                NOTIFICATION_BROKEN_VARIABLE: true
              });
        }

        if(!this.appSettings.INTERVAL_FLOWS) {
            await this.updateSettings({
                ...this.appSettings,
                INTERVAL_FLOWS: 3
            });
        }

        if(!this.appSettings.ALL_FLOWS) {
            await this.updateSettings({
                ...this.appSettings,
                ALL_FLOWS: 0,
                ALL_VARIABLES: 0
            });
        }

        if(!this.appSettings.INTERVAL_ENABLED) {
            await this.updateSettings({
                ...this.appSettings,
                INTERVAL_ENABLED: true
            });
        }
      } else {
        this.log(`Initializing ${_settingsKey} with defaults`);
        await this.updateSettings({
          BROKEN: [],
          DISABLED: [],
          BROKEN_VARIABLE: [],
          NOTIFICATION_BROKEN: true,
          NOTIFICATION_DISABLED: false,
          NOTIFICATION_BROKEN_VARIABLE: true,
          ALL_FLOWS: 0,
          ALL_VARIABLES: 0,
          HOMEY_ID: ''
        });
      }
    } catch (err) {
      this.error(err);
    }
  }

  async updateSettings(settings) {
    try {
      const oldSettings = this.appSettings;
      
      this.log("[updateSettings] - New settings:", settings);
      this.appSettings = settings;
      
      await this.homey.settings.set(_settingsKey, this.appSettings);  

      if(oldSettings.INTERVAL_FLOWS && settings.INTERVAL_ENABLED) {
        this.log("[updateSettings] - Comparing intervals", settings.INTERVAL_FLOWS, oldSettings.INTERVAL_FLOWS);
        if(settings.INTERVAL_FLOWS !== oldSettings.INTERVAL_FLOWS) {
            this.setFindFlowsInterval(true);
        }
      }
    } catch (error) {
      this.error(err);
    }
  }

  async createTokens() {
    this.token_BROKEN = await this.homey.flow.createToken("token_BROKEN", {
        type: "number",
        title: this.homey.__("settings.flows_broken")
      });

      this.token_DISABLED = await this.homey.flow.createToken("token_DISABLED", {
        type: "number",
        title: this.homey.__("settings.flows_disabled")
      });

      this.token_BROKEN_VARIABLE = await this.homey.flow.createToken("token_BROKEN_VARIABLE", {
        type: "number",
        title: this.homey.__("settings.flows_broken_variable")
      });

      this.token_ALL_VARIABLES = await this.homey.flow.createToken("token_ALL_VARIABLES", {
        type: "number",
        title: this.homey.__("settings.all_variables")
      });

      this.token_ALL_FLOWS = await this.homey.flow.createToken("token_ALL_FLOWS", {
        type: "number",
        title: this.homey.__("settings.all_flows")
      });

      await this.token_BROKEN.setValue(this.appSettings.BROKEN.length);
      await this.token_DISABLED.setValue(this.appSettings.DISABLED.length);
      await this.token_BROKEN_VARIABLE.setValue(this.appSettings.BROKEN_VARIABLE.length);
      await this.token_ALL_VARIABLES.setValue(this.appSettings.ALL_VARIABLES);
      await this.token_ALL_FLOWS.setValue(this.appSettings.ALL_FLOWS);
  }

  async setHomeyInfo() {
      try {
        const homeyInfo = await this._api.system.getInfo();
        await this.updateSettings({
            ...this.appSettings,
            HOMEY_ID: homeyInfo.cloudId || ''
        });
      } catch (error) {
        this.error(error);
      }
  }

// -------------------- FUNCTIONS ----------------------

    async setFindFlowsInterval(clear = false) {
      const REFRESH_INTERVAL = 1000 * (this.appSettings.INTERVAL_FLOWS * 60);

      if(clear) {
        this.log(`[onPollInterval] - Clearinterval`);
        this.homey.clearInterval(this.onPollInterval);
      }

      this.log(`[onPollInterval]`, this.appSettings.INTERVAL_FLOWS, REFRESH_INTERVAL);
      this.onPollInterval = this.homey.setInterval(this.findFlowDefects.bind(this), REFRESH_INTERVAL);
    }
  
    async findFlowDefects(initial = false, force = false) {
      try {
        await this.findFlows('BROKEN');
        await this.findFlows('DISABLED');

        if(force || this.interval % (this.appSettings.INTERVAL_FLOWS * 10) === 0) {
            this.log(`[findFlowDefects] BROKEN_VARIABLE - this.interval: ${this.interval} | force: ${force}`);
            await this.findLogic('BROKEN_VARIABLE');
        }

        if(initial && this.appSettings.INTERVAL_ENABLED) {
            await sleep(9000);
            await this.setFindFlowsInterval();
        }

        if(!force) this.interval = this.interval + this.appSettings.INTERVAL_FLOWS;
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

        flows = flows.map((f) => ({name: f.name, id: f.id}));
    
        if (flowArray.length !== flows.length) {
          await this.updateSettings({...this.appSettings, [key]: [...new Set(flows)]});
          await this[`token_${key}`].setValue(flows.length);
          await this.checkFlowDiff(key, flows, flowArray);
        }
    }

    async findLogic(key) {
        const flowArray = this.appSettings[key];
        this.ALL_VARIABLES = 0;

        this.log(`[findLogic] ${key} - flowArray: `, flowArray);

        let homeyVariables = Object.values(await this._api.logic.getVariables());
        homeyVariables = homeyVariables.map((f) => (`homey:manager:logic|${f.id}`));

        let homeyDevices = Object.values(await this._api.devices.getDevices());
        homeyDevices = homeyDevices.map((f) => (`homey:device:${f.id}`));
        
        const flows = Object.values(await this._api.flow.getFlows());
        
        let filteredFlows = flows.filter(f => !f.broken).filter(flow =>  {
            let logicVariables = [];
            let logicDevices = [];
            const trigger = flow.trigger;
            const conditions = flow.conditions;
            const actions = flow.actions;

            [trigger, ...conditions, ...actions].forEach(f => {
                if(f.uri && f.uri === 'homey:manager:logic' && f.args && f.args.variable && f.args.variable.id) {
                    logicVariables.push(`homey:manager:logic|${f.args.variable.id}`);
                } else if(f.droptoken && f.droptoken.includes('homey:manager:logic')) {
                    logicVariables.push(f.droptoken);
                } else if(f.droptoken && f.droptoken.includes('homey:device:')) {
                    logicDevices.push(f.droptoken.split('|')[0]);
                } else if(f.args) {
                    const argsArray = f.args && Object.values(f.args) || [];
                    if (!argsArray || !argsArray.length) return false;
    
                    const logicVar = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:manager:logic'));                
                    const logicDevice = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:device'));                

                    if(logicVar) {
                        const actionArray = logicVar.match(/(?<=\[\[)(.*?)(?=\]\])/g).filter(l => l.includes('homey:manager:logic'));
                        logicVariables = [...logicVariables, ...actionArray];
                    } else if(logicDevice) {
                        const actionArray = logicDevice.match(/(?<=\[(homey:device:))(.*?)(?=\|)/g).map(l => `homey:device:${l}`);
                        logicDevices = [...logicDevices, ...actionArray];
                    }
                }
            });

            this.ALL_VARIABLES = this.ALL_VARIABLES+logicVariables.length+logicDevices.length;

            if(logicVariables.length) {
                return !homeyVariables.some(r=> logicVariables.indexOf(r) >= 0);
            } else if(logicDevices.length) {
                return !homeyDevices.some(r=> logicDevices.indexOf(r) >= 0);
            }

            return false;
        });
        
        filteredFlows = filteredFlows.map((f) => ({name: f.name, id: f.id}));

        await this.token_ALL_FLOWS.setValue(flows.length);
        await this.token_ALL_VARIABLES.setValue(this.ALL_VARIABLES);

        if (flowArray.length !== filteredFlows.length) {
            await this.updateSettings({...this.appSettings, [key]: [...new Set(filteredFlows)], ALL_FLOWS: flows.length, ALL_VARIABLES: this.ALL_VARIABLES});
            await this[`token_${key}`].setValue(filteredFlows.length);
            await this.checkFlowDiff(key, filteredFlows, flowArray)
        } else {
            await this.updateSettings({...this.appSettings, ALL_FLOWS: flows.length, ALL_VARIABLES: this.ALL_VARIABLES});
        }
    }

    async checkFlowDiff(key, flows, flowArray) {
      try {
        const flowDiff = flows.filter(({ id: id1 }) => !flowArray.some(({ id: id2 }) => id2 === id1));
        const flowDiffReverse = flowArray.filter(({ id: id1 }) => !flows.some(({ id: id2 }) => id2 === id1));

        this.log(`[flowDiff] ${key} - flowDiff: `, flowDiff);
        this.log(`[flowDiff] ${key} - flowDiffReverse: `, flowDiffReverse);
  
        if(flowDiff.length) {
          flowDiff.forEach(async flow =>  {
            await this.setNotification(key, flow.name, 'Flow');
            await this.homey.flow.getTriggerCard(`trigger_${key}`).trigger({flow: flow.name, id: flow.id})
                .catch( this.error )
                .then(this.log(`[flowDiff] ${key} - Triggered: "${flow.name} | ${flow.id}"`)); 
          });
        }

        if(flowDiffReverse.length) {
            flowDiffReverse.forEach(async flow =>  {
              await this.homey.flow.getTriggerCard(`trigger_FIXED`).trigger({flow: flow.name, id: flow.id})
                  .catch( this.error )
                  .then(this.log(`[flowDiff] FIXED - Triggered: "${flow.name} | ${flow.id}"`)); 
            });
        }
      } catch (error) {
        this.error(error);
      }
     
    }

    async setNotification(key, flow, type) {
      try {
        if(this.appSettings[`NOTIFICATION_${key}`]) {
            await this.homey.notifications.createNotification({
            excerpt: `FlowChecker -  Event: ${key} - ${type}: **${flow}**`,
            });
        }
      } catch (error) {
        this.error(error);
      }
    }
}

module.exports = App;
