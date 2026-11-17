// Dependency module for the tally counter PCI, in the AMD form the QTI 3.0 PCI
// specification designates as the default module resolution.
define('tally_lib', [], function () {
	function toInteger(value, fallback) {
		var parsed = parseInt(value, 10);
		return Number.isNaN(parsed) ? fallback : parsed;
	}

	return {
		toInteger: toInteger,
		clamp: function (value, min, max) {
			return Math.min(max, Math.max(min, value));
		},
	};
});
