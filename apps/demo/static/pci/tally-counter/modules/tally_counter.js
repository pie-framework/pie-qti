// Entry module of the tally counter PCI: registers against the page's
// qtiCustomInteractionContext and implements the instance contract. The response
// is an integer in QTI variable JSON, null until the candidate changes the count.
define('tally_counter', ['tally_lib'], function (tally) {
	var STYLE = [
		'.tally { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }',
		'.tally-button { min-width: 2.75rem; min-height: 2.75rem; padding: 0.5rem 1rem;',
		'  font: inherit; border: 1px solid currentColor; border-radius: 0.5rem;',
		'  background: transparent; color: inherit; cursor: pointer; }',
		'.tally-button:focus-visible { outline: 3px solid currentColor; outline-offset: 2px; }',
		'.tally-button:disabled { cursor: not-allowed; opacity: 0.6; }',
		'.tally-count { min-width: 2ch; font-size: 1.5rem; font-weight: 700; text-align: center; }',
	].join('\n');

	function seededCount(state) {
		if (!state || typeof state !== 'object') return null;
		if (typeof state.count === 'number') return state.count;
		if (state.base && typeof state.base.integer === 'number') return state.base.integer;
		return null;
	}

	function TallyCounter(dom, configuration, state) {
		var doc = dom.ownerDocument;
		var properties = configuration.properties || {};
		this._min = tally.toInteger(properties.min, 0);
		this._max = tally.toInteger(properties.max, 20);
		var held = seededCount(state);
		this._touched = held !== null;
		this._count = tally.clamp(held === null ? this._min : held, this._min, this._max);

		var style = doc.createElement('style');
		style.textContent = STYLE;

		var root = doc.createElement('div');
		root.className = 'tally';

		var label = doc.createElement('span');
		label.id = 'tally-label-' + configuration.responseIdentifier;
		label.textContent = properties.label || 'Count';

		var fewer = doc.createElement('button');
		fewer.type = 'button';
		fewer.className = 'tally-button';
		fewer.textContent = properties.decreaseLabel || 'One fewer';

		var output = doc.createElement('output');
		output.className = 'tally-count';
		output.setAttribute('aria-live', 'polite');
		output.setAttribute('aria-labelledby', label.id);

		var more = doc.createElement('button');
		more.type = 'button';
		more.className = 'tally-button';
		more.textContent = properties.increaseLabel || 'One more';

		var self = this;
		fewer.addEventListener('click', function () {
			self._step(-1);
		});
		more.addEventListener('click', function () {
			self._step(1);
		});

		root.appendChild(label);
		root.appendChild(fewer);
		root.appendChild(output);
		root.appendChild(more);
		dom.appendChild(style);
		dom.appendChild(root);

		this._nodes = [style, root];
		this._fewer = fewer;
		this._more = more;
		this._output = output;
		this._disabled = false;
		this._render();
	}

	TallyCounter.prototype._step = function (delta) {
		if (this._disabled) return;
		this._count = tally.clamp(this._count + delta, this._min, this._max);
		this._touched = true;
		this._render();
	};

	TallyCounter.prototype._render = function () {
		this._output.textContent = String(this._count);
		this._fewer.disabled = this._disabled || this._count <= this._min;
		this._more.disabled = this._disabled || this._count >= this._max;
	};

	TallyCounter.prototype.getResponse = function () {
		if (!this._touched) return null;
		return { base: { integer: this._count } };
	};

	TallyCounter.prototype.getState = function () {
		return this._touched ? { count: this._count } : null;
	};

	TallyCounter.prototype.disable = function () {
		this._disabled = true;
		this._render();
	};

	TallyCounter.prototype.enable = function () {
		this._disabled = false;
		this._render();
	};

	TallyCounter.prototype.destroy = function () {
		this._nodes.forEach(function (node) {
			if (node.parentNode) node.parentNode.removeChild(node);
		});
		this._nodes = [];
	};

	qtiCustomInteractionContext.register({
		typeIdentifier: 'urn:example:pci:tally_counter',
		getInstance: function (dom, configuration, state) {
			var instance = new TallyCounter(dom, configuration, state);
			configuration.onready(instance);
			return instance;
		},
	});
});
