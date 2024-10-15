const express = require('express');
const exphbs = require('express-handlebars');
const dotenv = require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

var path = require('path');

app.disable('x-powered-by');
app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next)=>{
        //force https
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(302, ['https://opf.sh', req.url].join('')); 
        }
        next();
    });
}

app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs.engine());
app.set('view engine', 'handlebars');
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/home'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));

// catch 404 and forward to error handler
app.use(function(req, res ) {
    res.json({"error":{code:404,status:"not found"}});
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});