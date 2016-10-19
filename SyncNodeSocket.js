"use strict";

class Request {
	constructor(data, concurrencyVersion) {
		this.requestGuid = SyncNode.guid();
		this.stamp = new Date();
		this.data = data;
		this.concurrencyVersion = concurrencyVersion;
	}
}

class SyncNodeSocket extends EventEmitter {
	constructor(path, defaultObject, host) {
		super();

		this.updatesDisabled = false; //To prevent loop when setting data received from server
		this.status = 'Initializing...';
		if (!(path[0] === '/'))
			path = '/' + path; //normalize
		this.path = path;
		this.openRequests = {};
		this.defaultObject = defaultObject || {};
		this.setLocal(new SyncNode(JSON.parse(localStorage.getItem(this.path)))); //get local cache
		host = host || ('//' + location.host);
		var socketHost = host + path;
		console.log('Connecting to namespace: "' + socketHost + '"');
		this.server = io(socketHost);
		this.server.on('connect', () => {
			console.log('*************CONNECTED');
			this.status = 'Connected';
			this.updateStatus(this.status);
			this.getLatest();
		});
		this.server.on('disconnect', () => {
			console.log('*************DISCONNECTED');
			this.status = 'Disconnected';
			this.updateStatus(this.status);
		});
		this.server.on('reconnect', (number) => {
			console.log('*************Reconnected after ' + number + ' tries');
			this.status = 'Connected';
			this.updateStatus(this.status);
		});
		this.server.on('reconnect_failed', (number) => {
			console.log('*************************Reconnection failed.');
		});
		this.server.on('update', (merge) => {
			//console.log('*************handle update: ', merge);
			this.updatesDisabled = true;
			var result = this.data.doMerge(merge, true);
			this.concurrencyVersion = merge.version;
			this.emit('updated', this.data, merge);
			this.updatesDisabled = false;
			//console.log('*************AFTER handle update: ', this.data);
		});
		this.server.on('updateResponse', (response) => {
			//console.log('*************handle response: ', response);
			this.clearRequest(response.requestGuid);
		});
		this.server.on('latest', (latest) => {
			if (!latest) {
				console.log('already has latest.'); //, this.data);
				this.emit('updated', this.data);
			}
			else {
				console.log('handle latest');
				localStorage.setItem(this.path, JSON.stringify(latest));
				this.setLocal(new SyncNode(latest));
			}
			this.sendOpenRequests();
		});
	}
	setLocal(syncNode) {		
		this.data = syncNode;
		this.data.on('updated', (updated, merge) => {
			localStorage.setItem(this.path, JSON.stringify(this.data));
			this.queueUpdate(merge);
			this.concurrencyVersion = merge.version;
			this.emit('updated', this.data, merge);
		});
		this.concurrencyVersion = this.data.version;
		this.emit('updated', this.data);
	}
	sendOpenRequests() {
		var keys = Object.keys(this.openRequests);
		keys.forEach((key) => {
			this.sendRequest(this.openRequests[key]);
		});
	}
	clearRequest(requestGuid) {
		delete this.openRequests[requestGuid];
	}
	getLatest() {
		this.sendOpenRequests();
		this.server.emit('getLatest', this.data.version); //, this.serverLastModified);
		console.log('sent get latest...', this.data.version);
	}
	updateStatus(status) {
		this.status = status;
		this.emit('statusChanged', this.path, this.status);
	}
	queueUpdate(update) {
		if (!this.updatesDisabled) {
			var request = new Request(update, this.concurrencyVersion);
			this.sendRequest(request);
		}
	}
	sendRequest(request) {
		this.openRequests[request.requestGuid] = request;
		if (this.server['connected']) {
			this.server.emit('update', request);
		}
	}
}
