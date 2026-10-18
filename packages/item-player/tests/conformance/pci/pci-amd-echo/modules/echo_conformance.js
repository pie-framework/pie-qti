// Entry module: declares its AMD dependency, registers against the page's
// qtiCustomInteractionContext, and implements the instance contract —
// getResponse() in QTI variable JSON, getState()/state round trip, and
// configuration.onready / ondone.
define('echo_conformance', ['echo_lib'], function (echoLib) {
	var lastState = undefined;

	function EchoInteraction(dom, configuration, state) {
		this._dom = dom;
		this._configuration = configuration;
		this._value = null;
		this._greeting = configuration.properties.greeting;
		this._finished = false;
		var input = dom.ownerDocument.createElement('input');
		input.type = 'text';
		var held = state && state.base && state.base.string;
		input.value = typeof held === 'string' ? held : '';
		var self = this;
		input.addEventListener('input', function () {
			self._value = { base: { string: echoLib.shout(input.value) } };
			if (input.value === 'done') {
				self._finished = true;
				configuration.ondone(self, { finished: true, greeting: self._greeting });
			}
		});
		dom.appendChild(input);
		this._input = input;
		this._receivedState = state;
	}

	EchoInteraction.prototype.getResponse = function () {
		if (this._value === null) return null;
		return this._value;
	};

	EchoInteraction.prototype.getState = function () {
		if (this._finished) return { finished: true, greeting: this._greeting };
		return { inputLength: this._input ? this._input.value.length : 0 };
	};

	EchoInteraction.prototype.destroy = function () {
		this._input = null;
	};

	qtiCustomInteractionContext.register({
		typeIdentifier: 'urn:example:pci:echo-conformance',
		getInstance: function (dom, configuration, state) {
			lastState = state;
			var instance = new EchoInteraction(dom, configuration, state);
			configuration.onready(instance, { ready: true });
			return instance;
		},
	});
});
