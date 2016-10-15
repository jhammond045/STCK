/**
 * STCK: simple two-way data binding without bullshit
 * 
 */
var STCK = function(_context, _prefix) {

	// Configurable things.
	var config = {

		// Default context for STCK elements. Can be a DOM query or a jQuery object.
		context: typeof _context == 'string' ? _context : null

		// Default prefix for STCK special attributes.
		, prefix: typeof _prefix == 'string' ? _prefix + '-' : 'stck-'

		// How frequently to query expressions for changes.
		, expressionInterval: 200
	};

	// Internal operational variables.
	var run = {
		// List of bound variables and their current values.
		bound: {}

		// List of arrays of functions to trigger when a variable's value changes.
		, watchers: {}

		// List of grouped radio buttons.
		, radios: []

		// List of expressions to watch for changes.
		, expressions: []

		// List of active event timeouts to prevent infinite looping.
		, activeEvent: {}
	};

	// Get all elements having the specified STCK attribute (prefix + attribute name), and, optionally, within the
	// specified context.
	function $getElements(type, context) {

		context = context ? context : config.context;
		return $('[' + getAttrName(type) + ']', context);

	}

	// Get the full attribute name of the specified STCK attribute (prefix + attribute name).
	function getAttrName(type) {

		return config.prefix + type;

	}

	// Get the value of the specified STCK attribute.
	function getAttrValue($this, type) {

		return $this.attr(getAttrName(type));

	}

	// Exception class.
	function stckException(message, level) {

		this.level = level;
		this.message = message;

		this.toString = function() {
			return "stckException: " + this.message;
		};

	}

	// Initializer.
	function init() {

		// Set up repeating element groups.
		$getElements('repeat').each(function() {

			var $this = $(this), name = getAttrValue($this, 'repeat');

			// Grab the group's HTML, wrap in a div, store in a variable, then clear it.
			var template = '<div>' + $this.html() + '</div>';
			$this.html('');

			// Attach handler for value change.
			bindHandler(name, function(name, oldValue, newValue) {
				applyRepeat($this, template, newValue);
			});
		});

		// Set up bound elements.
		$getElements('bind').each(function() {
			var $this = $(this);

			// Forms -- we bind all applicable controls within the form and don't need a name.
			if ($this.is('form')) {
				$this.find('input,textarea,select').each(function() {
					bindElement($(this));
				});
			}

			// Anything else.
			else {
				bindElement($this);
			}
		});

		// Set up if-elements.
		$getElements('if').each(function() {
			var $this = $(this), expression = getAttrValue($this, 'if');

			// Fairly simple. Bind the expression; show or hide based on expression's value.
			bindExpression($this, expression, function($this, oldValue, newValue) {
				if (newValue) {
					$this.show();
				} else {
					$this.hide();
				}
			});
		});

		// Set up click events.
		$getElements('click').each(function() {
			var $this = $(this), expression = getAttrValue($this, 'click');

			$this.click(function(e) {
				e.preventDefault();
				execExpression(expression);
			});
		});

		// Set up focus events.
		$getElements('focus').each(function() {
			genericEventBind(this, 'focus');
		});

		// Set up change events.
		$getElements('change').each(function() {
			genericEventBind(this, 'change');
		});

		// Trigger our expression runner to continuously check expressions.
		// Not super awesome from a performance perspective but it is what it is.
		setInterval(execExpressions, config.expressionInterval);

	}

	function genericEventBind(that, event) {

		var $this = $(that), expression = getAttrValue($this, event);

		$this.bind(event, function(e) {
			return execExpression(expression);
		});

	}

	// Used to prevent race conditions. May not be needed.
	function eventBlocked(name) {

		if (run.activeEvent[name]) return true;

		run.activeEvent[name] = setTimeout(function() {
			run.activeEvent[name] = null;
		}, 1);

		return false;

	}

	// Mark an element as "applied."
	function markApplied($this) {

		$this.addClass('stck-applied');

	}

	// Apply a repeating element group's HTML.
	function applyRepeat($this, template, value) {

		// Start by emptying it out.
		$this.html('');

		// Our value should be iterable. Look at each element in it.
		for (var i in value) {
			// Construct a template chunk.
			var $template = $('<div>' + template + '</div>');
			
			// Look at each bound element in the template.
			$getElements('bind', $template).each(function() {
				var $that = $(this), name = getAttrValue($that, 'bind');

				// Special variable name for iterator.
				if (name == 'i') {
					$that.html(i);
				}

				// Normal variable. Get the variable's value from value[i].keyname and place in template.
				else {
					$that.html(resolveBound(value[i], name)[resolveBoundProperty(name)]);
				}

				// Remove the attribute name to avoid any confusion later on.
				$that.removeAttr(getAttrName('bind'));
			});

			// Put the item in the element.
			$template.appendTo($this);
		}
	}

	// Bind an expression to an element and store it for continuous checking.
	function bindExpression($this, expression, callerFn) {

		// Construct our storage object.
		var obj = {
			$this: $this
			, expression: expression
			, lastValue: NaN
			, callerFn: callerFn
		};

		// Give it a first run.
		execExpression(obj);

		// Add it to our array.
		run.expressions.push(obj);

		// Mark as processed.
		markApplied($this);
	}

	// Run all stored expressions.
	function execExpressions() {

		for (var i = 0; i < run.expressions.length; i++) {

			// Run the expression.
			var value = execExpression(run.expressions[i].expression);

			// If the value has changed, or if lastValue is a NaN (first run), it's significant.
			if (value !== run.expressions[i].lastValue || isNaN(run.expressions[i].lastValue)) {

				// Call our caller function. Pass the element, the last value and the new value.
				run.expressions[i].callerFn(run.expressions[i].$this, run.expressions[i].lastValue, value);

				// Persist the new value as the last value.
				run.expressions[i].lastValue = value;
			}
		}

	}

	// Run a single expression.
	function execExpression(expression) {

		// Attach a special function to our key-value store so it can run in scope.
		run.bound._expression = function() {
			// This just runs the expresson's code (whatever it may be!).
			return eval(expression);
		};

		// Run it and get the return value.
		var returnValue = run.bound._expression();

		// Remove the special function.
		delete run.bound._expression;

		// Return the expression's return value.
		return returnValue;
	}

	// Bind an element to a variable.
	function bindElement($this) {

		var name = getAttrValue($this, 'bind');

		// We can get name two ways -- in our STCK attribute or in the plain ol' "name" attribute.
		if (!name) {
			name = $this.attr('name');

			// Complain if we can't find it.
			if (!name) {
				throw new stckException("Can't find attribute name for " + $this[0].outerHTML);
			}
		}

		// Input controls of various species.
		if ($this.is('input')) {
			if ($this.attr('type') == 'radio') {
				bindRadio($this, name, $this.attr('value'), $this.is(':checked'));
			} else if ($this.attr('type') == 'checkbox') {
				bindCheckbox($this, name, $this.val());
			} else {
				bindInput($this, name, $this.val());
			}
		}

		// Select and textare work more or less the same as input.
		else if ($this.is('select') || $this.is('textarea')) {
			bindInput($this, name, $this.val());
		}

		// One-way bindings for divs and other static elements.
		else if ($this.is('div') || $this.is('span') || $this.is('p') || $this.is('li')) {
			bindDisplay($this, name);
		}

		// Mark as processed.
		markApplied($this);
	}

	// Bind a simple static HTML element of some kind.
	function bindDisplay($this, name) {

		bindHandler(name, function(name, oldValue, newValue) {
			// When something changes, we just update the HTML.
			$this.html(newValue);
		});

	}

	// Bind an input/textarea/select element.
	function bindInput($this, name, sourceValue) {

		// Do we have an original value for this element and none in the store?
		if (sourceValue && !getBound(name)) {
			// Lazy-set it to the original value.
			setBound(name, sourceValue);
		}

		bindHandler(name, function(name, oldValue, newValue) {
			// Check to make sure the value actually changed.
			if ($this.val() != newValue) {
				// Set the new value.
				$this.val(newValue);
			}
		});

		// Trigger a variable change whenever something changes in the element.
		$this.on('keyup change', function() {
			eventBlocked(name);
			setBound(name, $this.val());
		});
	}

	// Bind a radio button. They're special because there can be multiple radios with the same name.
	function bindRadio($this, name, sourceValue, isSelected) {

		// Set up our radio list for this variable, if needed.
		if (typeof run.radios[name] == 'undefined') {
			run.radios[name] = [];
		}

		// If we have a selected radio, assume it's the current one and set its value.
		if (isSelected) {
			setBound(name, sourceValue);
		}

		// Add this radio to our radio list for this variable.
		run.radios[name].push({
			$element: $this
			, value: sourceValue
		});

		// If this is our first one in the list, attach our handler. We only need one handler per radio group.
		if (run.radios[name].length == 1) {
			bindHandler(name, function(name, oldValue, newValue) {
				// Whenever there is a change, process all radios in the group.
				for (var i = 0; i < run.radios[name].length; i++) {
					// Set or clear value as needed.
					run.radios[name][i].$element.prop('checked', newValue == run.radios[name][i].value);
				}
			});
		}

		// Trigger a variable change whenever a radio changes.
		$this.change(function() {
			eventBlocked(name);
			if ($this.is(':checked')) {
				setBound(name, sourceValue);
			}
		});
	}

	// Watch a variable for changes and call watcher function if it changes.
	function bindHandler(name, watcher) {

		// If we don't have this variable in the store yet, add it.
		if (typeof getBound(name) == 'undefined') {
			setBound(name, null);
		}

		// If we don't have a list of watchers for this variable yet, initialize it.
		if (typeof run.watchers[name] == 'undefined') {
			run.watchers[name] = [];
		}

		// Add the watcher function to the list of watchers for this variable.
		run.watchers[name].push(function(name, oldValue, newValue) {
			watcher(name, oldValue, newValue);
		});

		// Call the watcher function for the first time to apply initial state.
		watcher(name, null, getBound(name));

		// We only need to attach one watch for the entire set, so only do this once.
		if (run.watchers[name].length == 1) {

			// Resolve the name to its actual variable in the bound variables list and watch the appropriate property.
			(resolveBound(run.bound, name)).watch(resolveBoundProperty(name), function(resolvedName, oldValue, newValue) {

				// Run our watchers for the variable.
				execWatchers(name, oldValue, newValue);
				
				// watch() expects a value.
				return newValue;
			});
		}
	}

	// Run a set of watchers for the given variable.
	function execWatchers(name, oldValue, newValue) {

		if (typeof run.watchers[name] == 'undefined') return;

		// Call each watcher function in the order they were added.
		for (var i = 0; i < run.watchers[name].length; i++) {
			run.watchers[name][i](name, oldValue, newValue);
		}

	}

	// Set a variable in the bound variables list.
	function setBound(name, value) {

		resolveBound(run.bound, name)[resolveBoundProperty(name)] = value;

	}

	// Get the value of a variable in the bound variables list.
	function getBound(name) {

		return resolveBound(run.bound, name)[name];

	}

	// Resolve a deep variable name into the appropriate object from the bound variables list.
	// This is necessary to use string names like "object.property.name".
	function resolveBound(boundRef, name) {

		// If we have a dot, we need to go one level deeper.
		if (name.indexOf('.') > -1) {

			// Split by the first dot into a resolved key and a resolved name.
			var pieces = name.split('.'), resolvedKey = pieces.shift(), resolvedName = pieces.join('.');

			// Nothing there in the bound variables list yet? Add something.
			if (typeof boundRef[resolvedKey] == 'undefined') {
				boundRef[resolvedKey] = {};
			}

			// Return the reference.
			return resolveBound(boundRef[resolvedKey], resolvedName);
		}

		// No (further) resolution required.
		return boundRef;
	}

	// Resolve a deep variable name into its final property name.
	// Just involves fetching the piece after the last ".", if one is present.
	function resolveBoundProperty(name) {
		return name.split('.').pop();
	}

	// Helper function for bound variable list to manually trigger an update.
	// Necessary because watch() won't catch additions to arrays/objects.
	run.bound._update = function(name) {

		var value = getBound(name);

		// Run each watcher for the variable.
		execWatchers(name, null, value);

	}

	init();

	// Give the calling method the bound variable list.
	return run.bound;

};
