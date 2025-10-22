import { create } from 'express-handlebars';
import path from 'path';

const hbs = create({
    partialsDir: path.join(__dirname, '../views/partials'),
    helpers: {
        ifEquals: (value1: any, value2: any, options: any) => {
            if (value1 == value2) {
                return options.fn(this);
            }
            return options.inverse(this);
        },
        ifNotEquals: (value1: any, value2: any, options: any) => {
            if (value1 != value2) {
                return options.fn(this);
            }
            return options.inverse(this);
        },
        eq: (value1: any, value2: any) => {
            return value1 === value2;
        }
    }
});

export default hbs;
