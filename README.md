# STCK
Simple two-way data binding for HTML/JavaScript

https://jhammond045.github.io/STCK/

I wondered how hard it would be to make a simple set of data binding tools that functioned similar to Angular's basic directives, so I decided to give it a shot. 

Attributes supported:
 * `stck-bind`
 * `stck-if`
 * `stck-repeat` with internal `stck-bind`

Bells and whistles:
 * Two-way binding for `input`, `select`, `textarea`, etc.
 * One-way binding for `div`, `span`, `p`, etc.
 * Tries to support older browsers with the addition of `object.watch.js` (https://gist.github.com/eligrey/384583).
 * Deep properties are supported (e.g. `stck-bind="my.deep.property"`).
 * Fairly efficient expression monitoring for `stck-if`.

Very alpha. Almost totally untested!
