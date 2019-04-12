var express = require('express'),
reqlib = require('app-root-path').require,
logger = require('morgan'),
cookieParser = require('cookie-parser'),
bodyParser = require('body-parser'),
app = express(),
fs = require('fs'),
SerialPort = require('serialport'),
jsonStore = reqlib('/lib/jsonStore.js'),
cors = require('cors'),
ZWaveClient = reqlib('/lib/ZwaveClient'),
MqttClient = reqlib('/lib/MqttClient'),
Gateway = reqlib('/lib/Gateway'),
store = reqlib('config/store.js'),
debug = reqlib('/lib/debug')('App'),
utils = reqlib('/lib/utils.js');

var gw; //the gateway instance
let io;

debug("Application path:" + utils.getPath(true));

// view engine setup
app.set('views', utils.joinPath(utils.getPath(), 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
app.use(cookieParser());

app.use('/', express.static(utils.joinPath(utils.getPath(), 'dist')));

app.use(cors());

function startGateway(){
  var settings = jsonStore.get(store.settings);

  var mqtt, zwave;

  if(settings.mqtt){
    mqtt = new MqttClient(settings.mqtt);
  }

  if(settings.zwave){
    zwave = new ZWaveClient(settings.zwave, io);
  }

  gw = new Gateway(settings.gateway, zwave, mqtt);
}

app.startSocket = function(server){
  io = require('socket.io')(server);

  if(gw.zwave) gw.zwave.socket = io;

  io.on('connection', function(socket) {

    debug("New connection", socket.id);

    if(gw.zwave)
    socket.emit('INIT', {nodes: gw.zwave.nodes, info: gw.zwave.ozwConfig, error:gw.zwave.error, cntStatus: gw.zwave.cntStatus})

    socket.on('ZWAVE_API', function(data) {
      debug("Zwave api call:", data.api, data.args);
      if(gw.zwave){
        var result = gw.zwave.callApi(data.api, ...data.args);
        result.api = data.api;
        socket.emit("API_RETURN", result);
      }
    });

    socket.on('disconnect', function(){
      debug('User disconnected', socket.id);
    });

  });

  const interceptor = function(write) {
		return function(...args) {
			io.emit("DEBUG", args[0].toString())
			write.apply(process.stdout, args);
		};
	}

  process.stdout.write = interceptor(process.stdout.write);
  process.stderr.write = interceptor(process.stderr.write);
}

// ----- APIs ------

//get settings
app.get('/api/settings', function(req, res) {
  SerialPort.list(function (err, ports) {
    if (err) {
      debug(err);
    }
    var devices = gw.zwave ? gw.zwave.devices : {};
    res.json({success:true, settings: jsonStore.get(store.settings), devices: devices, serial_ports: ports ? ports.map(p => p.comName) : []});
  })
});

//get config
app.get('/api/exportConfig', function(req, res) {
  if(gw.zwave && gw.zwave.client && gw.zwave.ozwConfig && gw.zwave.ozwConfig.name){
    var result = gw.zwave.callApi('writeConfig');
    var homeHex = gw.zwave.ozwConfig.name;

    if(result.success){
      var filePath = utils.joinPath(utils.getPath(true), 'zwcfg_' + homeHex + '.xml');
      fs.readFile(filePath, 'utf8', function(err, data){
        if(err)
          res.json({success: false, message: err.message})
        else{
          res.json({success:true, homeHex: homeHex, data: data, message: "Successfully exported file"});
        }
      })
    }else{
      res.json(result);
    }

  }else{
    return res.json({success: false, message: "Zwave client not ready"})
  }
});

//import config
app.post('/api/importConfig', function(req, res) {
  if(gw.zwave && gw.zwave.client && gw.zwave.ozwConfig && gw.zwave.ozwConfig.name){

    var filePath = utils.joinPath(utils.getPath(true), 'zwcfg_' + gw.zwave.ozwConfig.name + '.xml');

    fs.writeFile(filePath, req.body.data, 'utf8', function(err){
      if(err)
        res.json({success: false, message: err.message})
      else{
        res.json({success:true, message: "Successfully imported file"});
      }
    })

  }else{
    return res.json({success: false, message: "Zwave client not ready"})
  }
});

//update settings
app.post('/api/settings', function(req, res) {
  jsonStore.put(store.settings, req.body)
  .then(data => {
    res.json({success: true, message: "Configuration updated successfully"});
    gw.close();
    startGateway();
  }).catch(err => {
    debug(err);
    res.json({success: false, message: err.message})
  })
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  debug(err);

  // render the error page
  res.status(err.status || 500);
  res.redirect('/');
});

startGateway();

process.removeAllListeners('SIGINT');

process.on('SIGINT', function() {
  debug('Closing...');
  gw.close();
  process.exit();
});

module.exports = app;
