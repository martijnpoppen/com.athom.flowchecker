const _settingsKey = `com.athom.flowchecker.settings`;

exports.init = async function () {
    console.log('Initializing Flow Checker conditions...');

    const condition_BROKEN = this.homey.flow.getConditionCard('condition_BROKEN')
    condition_BROKEN.registerRunListener( async () =>  {
        const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
       return appSettings.BROKEN.length > 0;
    });

    const condition_BROKEN_DISABLED = this.homey.flow.getConditionCard('condition_BROKEN_DISABLED')
    condition_BROKEN_DISABLED.registerRunListener( async () =>  {
        const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
       return appSettings.BROKEN_DISABLED.length > 0;
    });
    
    const condition_DISABLED = this.homey.flow.getConditionCard('condition_DISABLED')
    condition_DISABLED.registerRunListener( async () =>  {
       const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
        return appSettings.DISABLED.length > 0;
    });

    const condition_BROKEN_VARIABLE = this.homey.flow.getConditionCard('condition_BROKEN_VARIABLE')
    condition_BROKEN_VARIABLE.registerRunListener( async () =>  {
       const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
        return appSettings.BROKEN_VARIABLE.length > 0;
    });

    const condition_UNUSED_FLOWS = this.homey.flow.getConditionCard('condition_UNUSED_FLOWS')
    condition_UNUSED_FLOWS.registerRunListener( async () =>  {
       const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
        return appSettings.UNUSED_FLOWS.length > 0;
    });

    const condition_UNUSED_LOGIC = this.homey.flow.getConditionCard('condition_UNUSED_LOGIC')
    condition_UNUSED_LOGIC.registerRunListener( async () =>  {
       const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
        return appSettings.UNUSED_LOGIC.length > 0;
    });
};


