const { create } = require('express-handlebars');
const path = require('path');

const hbs = create({
        partialsDir: path.join(__dirname, '../views/partials'),
        // Specify helpers which are only registered on this instance.
        helpers: {
            ifEquals: (value1, value2, options) => {
                if (value1 == value2) {
                    return options.fn(this);             
                }
                return options.inverse(this);
            },
            ifNotEquals: (value1, value2, options) => {
                if (value1 != value2) {
                    return options.fn(this);             
                }
                return options.inverse(this);
            }
       }
});

// Register the custom helper directly on the handlebars instance used by express-handlebars
module.exports =  hbs;