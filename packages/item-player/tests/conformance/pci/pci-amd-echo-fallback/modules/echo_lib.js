// Dependency module, authored to the AMD contract the QTI 3.0 PCI specification
// designates as the default resolution.
define('echo_lib', [], function () {
	return {
		shout: function (text) {
			return String(text).toUpperCase();
		},
	};
});
