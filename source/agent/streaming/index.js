// Copyright (C) <2019> Intel Corporation
//
// SPDX-License-Identifier: Apache-2.0

'use strict';

var internalIO = require('../internalIO/build/Release/internalIO');
var InternalIn = internalIO.In;
var InternalOut = internalIO.Out;

var avstream = require('../avstreamLib/build/Release/avstream');
var AVStreamIn = avstream.AVStreamIn;
var AVStreamOut = avstream.AVStreamOut;
var logger = require('../logger').logger;
var path = require('path');
var Connections = require('./connections');

// Logger
var log = logger.getLogger('StreamingNode');

var InternalConnectionFactory = require('./InternalConnectionFactory');

module.exports = function(rpcClient, selfRpcId, parentRpcId, clusterWorkerIP) {
    var that = {
        agentID: parentRpcId,
        clusterIP: clusterWorkerIP
    };
    var connections = new Connections;
    var internalConnFactory = new InternalConnectionFactory;

    var notifyStatus = (controller, sessionId, direction, status) => {
        rpcClient.remoteCast(controller, 'onSessionProgress', [sessionId, direction, status]);
    };

    var createAVStreamIn = function(sessionId, options) {
        var avstream_options = {
            type: 'streaming',
            has_audio: (options.media.audio === 'auto' ? 'auto' : (!!options.media.audio ? 'yes' : 'no')),
            has_video: (options.media.video === 'auto' ? 'auto' : (!!options.media.video ? 'yes' : 'no')),
            transport: options.connection.transportProtocol,
            buffer_size: options.connection.bufferSize,
            url: options.connection.url
        };

        var connection = new AVStreamIn(avstream_options, function(message) {
            log.debug('avstream-in status message:', message);
            notifyStatus(options.controller, sessionId, 'in', JSON.parse(message));
        });

        return connection;
    };

    var createAVStreamOut = function(connectionId, options) {
        var avstream_options = {
            type: 'streaming',
            require_audio: !!options.media.audio,
            require_video: !!options.media.video,
            connection: options.connection,
            initializeTimeout: global.config.avstream.initializeTimeout
        };

        if ((options.connection.protocol === 'dash' || options.connection.protocol === 'hls') && !options.connection.url.startsWith('http')) {
            var fs = require('fs');
            if (fs.existsSync(options.connection.url)) {
                log.error('avstream-out init error: file existed.');
                notifyStatus(options.controller, connectionId, 'out', {
                    type: 'failed',
                    reason: 'file existed.'
                });
                return;
            }
        }

        var connection = new AVStreamOut(avstream_options, function(error) {
            if (error) {
                log.error('avstream-out init error:', error);
                notifyStatus(options.controller, connectionId, 'out', {
                    type: 'failed',
                    reason: error
                });
            } else {
                notifyStatus(options.controller, connectionId, 'out', {
                    type: 'ready',
                    info: options.connection.url
                });
            }
        });
        connection.addEventListener('fatal', function(error) {
            if (error) {
                log.error('avstream-out fatal error:', error);
                notifyStatus(options.controller, connectionId, 'out', {
                    type: 'failed',
                    reason: 'avstream_out fatal error: ' + error
                });
            }
        });

        connection.receiver = function(type) {
            return this;
        };
        return connection;
    };

    var onSuccess = function(callback) {
        return function(result) {
            callback('callback', result);
        };
    };

    var onError = function(callback) {
        return function(reason) {
            if (typeof reason === 'string') {
                callback('callback', 'error', reason);
            } else {
                callback('callback', reason);
            }
        };
    };

    var getIP = function(networkinterface) {
        var networkInterfaces = require('os').networkInterfaces();
        var address = [];
        if (networkinterface) {
            var iface = networkInterfaces[networkinterface];
            for (var i = 0; i < iface.length; i++) {
                var alias = iface[i];
                if (alias.family === "IPv4" && alias.address !== '127.0.0.1' && !alias.internal) {
                    address.push(alias.address);
                }
            }
        } else {
            for (var devName in networkInterfaces) {
                var iface = networkInterfaces[devName];
                for (var i = 0; i < iface.length; i++) {
                    var alias = iface[i];
                    if (alias.family === "IPv4" && alias.address !== '127.0.0.1' && !alias.internal) {
                        address.push(alias.address);
                    }
                }
            }
        }

        return address;
    };


    that.createInternalConnection = function(connectionId, direction, internalOpt, callback) {
        internalOpt.minport = global.config.internal.minport;
        internalOpt.maxport = global.config.internal.maxport;
        var portInfo = internalConnFactory.create(connectionId, direction, internalOpt);
        callback('callback', {
            ip: global.config.internal.ip_address,
            port: portInfo
        });
    };

    that.destroyInternalConnection = function(connectionId, direction, callback) {
        internalConnFactory.destroy(connectionId, direction);
        callback('callback', 'ok');
    };

    that.publish = function(connectionId, connectionType, options, callback) {
        log.debug('publish, connectionId:', connectionId, 'connectionType:', connectionType, 'options:', options);
        if (connections.getConnection(connectionId)) {
            return callback('callback', {
                type: 'failed',
                reason: 'Connection already exists:' + connectionId
            });
        }

        var conn = null;
        var srtresult = null;
        switch (connectionType) {
            case 'internal':
                conn = internalConnFactory.fetch(connectionId, 'in');
                if (conn)
                    conn.connect(options);
                break;
            case 'streaming':
                if (options.connection.type == 'srt') {
                    var minport = global.config.external.minport;
                    var maxport = global.config.external.maxport;
                    var srtmode = 'listener';

                    if (options.connection.mode) {
                        srtmode = options.connection.mode;
                    }
                    if (srtmode == 'listener') {
                        var portfinder = require('portfinder');
                        portfinder.getPortPromise({port:minport, stopPort:maxport}).then(port => {
                            log.debug('Port is available!', port);

                            var srturl = 'srt://0.0.0.0:' + port + '?mode=' + srtmode;
                            if (options.connection.latency) {
                                srturl = srturl + '&latency=' + options.connection.latency;
                            }

                            if (options.connection.listen_timeout) {
                                srturl = srturl + '&listen_timeout=' + options.connection.listen_timeout;
                            }

                            if(options.connection.passphrase) {
                                var randomstring = require("randomstring");
                                var passphrase = randomstring.generate(32);
                                strurl = strurl + '&passphrase=' + passphrase;
                            }

                            var srtoptions = {
                                controller: options.controller,
                                connection: {
                                    url: srturl,
                                    transportProtocol: 'udp'
                                },
                                media: options.media
                            };

                            var networkInterface = global.config.external.network_interface;
                            var address = getIP(networkInterface);

                            var srtip = global.config.external.ip_address;

                            if (srtip != "") {
                                address.push(srtip);
                            }

                            srtresult = {
                                ip: address,
                                port: port,
                                streamid: connectionId
                            };

                            log.debug("srt result is:", srtresult);
                            log.debug('srt options is:', srtoptions);


                            callback('callback', srtresult);
                            conn = createAVStreamIn(connectionId, srtoptions);

                            if (!conn) {
                                log.error('Create connection failed', connectionId);
                                return ;
                            }

                            return connections.addConnection(connectionId, connectionType, options.controller, conn, 'in')
                                .then(function() {
                                    log.debug("add connection succeed");
                                }, function() {
                                    log.debug("add connection failed");
                                });
                        });
                    } else {
                        var srturl = options.connection.url + '?mode=' + srtmode;
                        if (options.connection.latency) {
                            srturl = srturl + '&latency=' + options.connection.latency;
                        }

                        if(options.connection.passphrase) {
                            strurl = strurl + '&passphrase=' + options.connection.passphrase;
                        }

                        var srtoptions = {
                            controller: options.controller,
                            connection: {
                                url: srturl,
                                transportProtocol: 'udp'
                            },
                            media: options.media
                        };
                        srtresult = {
                            streamid: connectionId
                        };
                        
                        conn = createAVStreamIn(connectionId, srtoptions);

                        if (!conn) {
                            log.error('Create connection failed', connectionId);
                            return callback('callback', {
                                type: 'failed',
                                reason: 'Create Connection failed'
                            });
                        }

                        return connections.addConnection(connectionId, connectionType, options.controller, conn, 'in')
                            .then(function() {
                                callback('callback', srtresult);
                            }, onError(callback));
                    }
                } else {
                    conn = createAVStreamIn(connectionId, options);
                }
                break;
            default:
                log.error('Connection type invalid:' + connectionType);
        }


        if (options.connection.type != 'srt') {
            if (!conn) {
                log.error('Create connection failed', connectionId);
                return callback('callback', {
                    type: 'failed',
                    reason: 'Create Connection failed'
                });
            }

            return connections.addConnection(connectionId, connectionType, options.controller, conn, 'in')
                .then(onSuccess(callback), onError(callback));
        }
    };

    that.unpublish = function(connectionId, callback) {
        log.debug('unpublish, connectionId:', connectionId);
        var conn = connections.getConnection(connectionId);
        connections.removeConnection(connectionId).then(function(ok) {
            if (conn && conn.type === 'internal') {
                internalConnFactory.destroy(connectionId, 'in');
            } else if (conn) {
                conn.connection.close();
            }
            callback('callback', 'ok');
        }, onError(callback));
    };

    that.subscribe = function(connectionId, connectionType, options, callback) {
        log.debug('subscribe, connectionId:', connectionId, 'connectionType:', connectionType, 'options:', options);
        if (connections.getConnection(connectionId)) {
            return callback('callback', {
                type: 'failed',
                reason: 'Connection already exists:' + connectionId
            });
        }

        var conn = null;
        switch (connectionType) {
            case 'internal':
                conn = internalConnFactory.fetch(connectionId, 'out');
                if (conn)
                    conn.connect(options);
                break;
            case 'streaming':
                conn = createAVStreamOut(connectionId, options);
                break;
            default:
                log.error('Connection type invalid:' + connectionType);
        }
        if (!conn) {
            log.error('Create connection failed', connectionId, connectionType);
            return callback('callback', {
                type: 'failed',
                reason: 'Create Connection failed'
            });
        }

        connections.addConnection(connectionId, connectionType, options.controller, conn, 'out')
            .then(onSuccess(callback), onError(callback));
    };

    that.unsubscribe = function(connectionId, callback) {
        log.debug('unsubscribe, connectionId:', connectionId);
        var conn = connections.getConnection(connectionId);
        connections.removeConnection(connectionId).then(function(ok) {
            if (conn && conn.type === 'internal') {
                internalConnFactory.destroy(connectionId, 'out');
            } else if (conn) {
                conn.connection.close();
            }
            callback('callback', 'ok');
        }, onError(callback));
    };

    that.linkup = function(connectionId, audioFrom, videoFrom, callback) {
        connections.linkupConnection(connectionId, audioFrom, videoFrom).then(onSuccess(callback), onError(callback));
    };

    that.cutoff = function(connectionId, callback) {
        connections.cutoffConnection(connectionId).then(onSuccess(callback), onError(callback));
    };

    that.close = function() {
        log.debug('close called');
        var connIds = connections.getIds();
        for (let connectionId of connIds) {
            var conn = connections.getConnection(connectionId);
            connections.removeConnection(connectionId);
            if (conn && conn.type === 'internal') {
                internalConnFactory.destroy(connectionId, conn.direction);
            } else if (conn) {
                conn.connection.close();
            }
        }
    };

    that.onFaultDetected = function(message) {
        connections.onFaultDetected(message);
    };

    return that;
};
