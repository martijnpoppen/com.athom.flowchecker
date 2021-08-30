module.exports = {
    async settings({ homey, body }){
        return homey.app.updateSettings( body );
    }
};