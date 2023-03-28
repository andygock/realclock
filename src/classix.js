//
// https://github.com/alexnault/classix
// MIT License, Copyright (c) 2022 Alex Nault
//
/**
 * Conditionally join classNames into a single string
 * @param {...String} args The expressions to evaluate
 * @returns {String} The joined classNames
 */
function cx(...args) {
  let str = "",
    i = 0,
    arg;

  for (; i < arguments.length; ) {
    if ((arg = arguments[i++]) && typeof arg === "string") {
      str && (str += " ");
      str += arg;
    }
  }
  return str;
}

export { cx };
export default cx;
