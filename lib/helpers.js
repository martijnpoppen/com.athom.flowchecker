exports.sleep = async function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

function flattenObjectToValues(obj, parent, res = {}) {
    for (const key of Object.keys(obj)) {
      const propName = parent ? parent + '.' + key : key;
      if (typeof obj[key] === 'object') {
        flattenObjectToValues(obj[key], propName, res);
      } else {
        res[propName] = obj[key];
      }
    }
    return Object.values(res);
  }

exports.flattenObj = flattenObjectToValues;