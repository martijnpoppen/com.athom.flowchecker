exports.init = async function (homey) {
    const condition_BROKEN = homey.flow.getConditionCard('condition_BROKEN')
    condition_BROKEN.registerRunListener( async () =>  {
        console.log(homey.app.appSettings.BROKEN)
       return homey.app.appSettings.BROKEN.length > 0;
    });
    
    const condition_DISABLED = homey.flow.getConditionCard('condition_DISABLED')
    condition_DISABLED.registerRunListener( async () =>  {
       return homey.app.appSettings.DISABLED.length > 0;
    });
};


