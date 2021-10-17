exports.init = async function (homey) {
    const condition_BROKEN = homey.flow.getConditionCard('condition_BROKEN')
    condition_BROKEN.registerRunListener( async () =>  {
       return homey.app.appSettings.BROKEN.length > 0;
    });
    
    const condition_DISABLED = homey.flow.getConditionCard('condition_DISABLED')
    condition_DISABLED.registerRunListener( async () =>  {
       return homey.app.appSettings.DISABLED.length > 0;
    });

    const condition_BROKEN_VARIABLE = homey.flow.getConditionCard('condition_BROKEN_VARIABLE')
    condition_BROKEN_VARIABLE.registerRunListener( async () =>  {
       return homey.app.appSettings.BROKEN_VARIABLE.length > 0;
    });

    const condition_UNUSED_FLOWS = homey.flow.getConditionCard('condition_UNUSED_FLOWS')
    condition_UNUSED_FLOWS.registerRunListener( async () =>  {
       return homey.app.appSettings.UNUSED_FLOWS.length > 0;
    });

    const condition_UNUSED_LOGIC = homey.flow.getConditionCard('condition_UNUSED_LOGIC')
    condition_UNUSED_LOGIC.registerRunListener( async () =>  {
       return homey.app.appSettings.UNUSED_LOGIC.length > 0;
    });
};


