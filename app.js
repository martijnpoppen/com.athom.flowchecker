"use strict";

const Homey = require("homey");
const HomeyAPI = require("athom-api").HomeyAPI;
const flowConditions = require('./lib/flows/conditions');
const { sleep } = require('./lib/helpers');

const _settingsKey = `${Homey.manifest.id}.settings`;
const _refreshInterval = 3;

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

      } else {
        this.log(`Initializing ${_settingsKey} with defaults`);
        await this.updateSettings({
          BROKEN: [],
          DISABLED: [],
          BROKEN_VARIABLE: [],
          NOTIFICATION_BROKEN: true,
          NOTIFICATION_DISABLED: false,
          NOTIFICATION_BROKEN_VARIABLE: true
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

    async setFindFlowsInterval() {
      const REFRESH_INTERVAL = 1000 * (_refreshInterval * 60);

      this.log(`[onPollInterval]`, _refreshInterval, REFRESH_INTERVAL);
      this.onPollInterval = setInterval(this.findFlowDefects.bind(this), REFRESH_INTERVAL);
    }
  
    async findFlowDefects(initial = false) {
      try {
        await this.findFlows('BROKEN');
        await this.findFlows('DISABLED');

        if(this.interval % (_refreshInterval * 10) === 0) {
            this.log(`[findFlowDefects] BROKEN_VARIABLE - this.interval: `, this.interval);
            await this.findLogic('BROKEN_VARIABLE');
        }

        if(initial) {
            await sleep(9000);
            await this.setFindFlowsInterval();
        }

        this.interval = this.interval + _refreshInterval;
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
          await this.checkFlowDiff(key, flows, flowArray);
        }
    }

    async findLogic(key) {
        const flowArray = this.appSettings[key];

        this.log(`[findLogic] ${key} - flowArray: `, flowArray);

        let logicVariables = Object.values(await this._api.logic.getVariables());
        logicVariables = logicVariables.map((f) => (`homey:manager:logic|${f.id}`));

        let deviceVariables = Object.values(await this._api.devices.getDevices());
        deviceVariables = deviceVariables.map((f) => (`homey:device:${f.id}`));
        
        const flows = Object.values(await this._api.flow.getFlows({ filter: { broken: false, enabled: true } }));
        
        let filteredFlows = flows.filter(flow =>  {
            let logicVariablesArray = [];
            let logicDeviceArray = [];
            const trigger = flow.trigger;
            const conditions = flow.conditions;
            const actions = flow.actions;

            [trigger, ...conditions, ...actions].forEach(f => {
                if(f.uri && f.uri === 'homey:manager:logic' && f.args && f.args.variable && f.args.variable.id) {
                    logicVariablesArray.push(`homey:manager:logic|${f.args.variable.id}`);
                } else if(f.droptoken && f.droptoken.includes('homey:manager:logic')) {
                    logicVariablesArray.push(f.droptoken);
                } else if(f.droptoken && f.droptoken.includes('homey:device:')) {
                    logicDeviceArray.push(f.droptoken.split('|')[0]);
                } else if(f.args) {
                    const argsArray = f.args && Object.values(f.args) || [];
                    if (!argsArray || !argsArray.length) return false;
    
                    const logicVar = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:manager:logic'));                
                    const logicDevice = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:device'));                

                    if(logicVar) {
                        const actionArray = logicVar.match(/(?<=\[\[)(.*?)(?=\]\])/g).filter(l => l.includes('homey:manager:logic'));
                        logicVariablesArray = [...logicVariablesArray, ...actionArray];
                    } else if(logicDevice) {
                        const actionArray = logicDevice.match(/(?<=\[\[)(.*?)(?=\|)/g).filter(l => l.includes('homey:device'));
                        logicDeviceArray = [...logicDeviceArray, ...actionArray];
                    }
                }
            });            

            if(logicVariablesArray.length) {
                // console.log('logicVariablesArray', logicVariablesArray);
                return !logicVariables.some(r=> logicVariablesArray.indexOf(r) >= 0);
            } else if(logicDeviceArray.length) {
                console.log('logicDeviceArray', logicDeviceArray);
                return !deviceVariables.some(r=> logicDeviceArray.indexOf(r) >= 0);
            }

            return false;
        });
        
        filteredFlows = filteredFlows.map((f) => ({name: f.name, id: f.id}));

        if (flowArray.length !== filteredFlows.length) {
            await this.updateSettings({...this.appSettings, [key]: [...new Set(filteredFlows)]});
            await this.checkFlowDiff(key, filteredFlows, flowArray)
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
