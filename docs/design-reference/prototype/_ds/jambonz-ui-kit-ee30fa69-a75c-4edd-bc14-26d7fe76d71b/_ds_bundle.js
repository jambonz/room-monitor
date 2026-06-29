/* @ds-bundle: {"namespace":"JambonzUiKit","components":[{"name":"Button","sourcePath":"components/buttons/Button/Button.jsx"},{"name":"ButtonGroup","sourcePath":"components/buttons/ButtonGroup/ButtonGroup.jsx"},{"name":"H1","sourcePath":"components/typography/H1/H1.jsx"},{"name":"H2","sourcePath":"components/typography/H2/H2.jsx"},{"name":"H3","sourcePath":"components/typography/H3/H3.jsx"},{"name":"H4","sourcePath":"components/typography/H4/H4.jsx"},{"name":"H5","sourcePath":"components/typography/H5/H5.jsx"},{"name":"H6","sourcePath":"components/typography/H6/H6.jsx"},{"name":"Icon","sourcePath":"components/icons/Icon/Icon.jsx"},{"name":"IconGroup","sourcePath":"components/icons/IconGroup/IconGroup.jsx"},{"name":"M","sourcePath":"components/typography/M/M.jsx"},{"name":"MS","sourcePath":"components/typography/MS/MS.jsx"},{"name":"MXS","sourcePath":"components/typography/MXS/MXS.jsx"},{"name":"P","sourcePath":"components/typography/P/P.jsx"},{"name":"Tabs","sourcePath":"components/jambonz-ui/Tabs/Tabs.jsx"}],"sourceHashes":{"components/buttons/Button/Button.jsx":"9b4e405906db","components/buttons/Button/Button.d.ts":"a020be02e7fb","components/buttons/Button/Button.prompt.md":"a53b4b243359","components/buttons/ButtonGroup/ButtonGroup.jsx":"76d2c6eaaaf9","components/buttons/ButtonGroup/ButtonGroup.d.ts":"f0feafe2264e","components/buttons/ButtonGroup/ButtonGroup.prompt.md":"6ea3d184f21a","components/typography/H1/H1.jsx":"fa9a2bd600fa","components/typography/H1/H1.d.ts":"04aed8d10f7b","components/typography/H1/H1.prompt.md":"280dd5afc70b","components/typography/H2/H2.jsx":"3f5ac7753e1a","components/typography/H2/H2.d.ts":"e37aecbf50f2","components/typography/H2/H2.prompt.md":"0abced9d8cec","components/typography/H3/H3.jsx":"74d116ec95e3","components/typography/H3/H3.d.ts":"2a38bcea3990","components/typography/H3/H3.prompt.md":"8bdb8de20092","components/typography/H4/H4.jsx":"5c283bb7b5a0","components/typography/H4/H4.d.ts":"fde08fae9005","components/typography/H4/H4.prompt.md":"21b8e43d897d","components/typography/H5/H5.jsx":"24e0be0c7b9e","components/typography/H5/H5.d.ts":"66f1755065d3","components/typography/H5/H5.prompt.md":"df3d4a3e01c0","components/typography/H6/H6.jsx":"b3a1bc995b8b","components/typography/H6/H6.d.ts":"13de121a055f","components/typography/H6/H6.prompt.md":"934e063cbfa9","components/icons/Icon/Icon.jsx":"2601057f9e8d","components/icons/Icon/Icon.d.ts":"84af20027d9b","components/icons/Icon/Icon.prompt.md":"5efffaf79a10","components/icons/IconGroup/IconGroup.jsx":"d5eda5cea8ae","components/icons/IconGroup/IconGroup.d.ts":"54424f2bd39a","components/icons/IconGroup/IconGroup.prompt.md":"28b5e1edbd41","components/typography/M/M.jsx":"892210dd1c82","components/typography/M/M.d.ts":"4d76a1fa04f2","components/typography/M/M.prompt.md":"bb7c3f7b9b8d","components/typography/MS/MS.jsx":"cdcefad70cbf","components/typography/MS/MS.d.ts":"3adf98dbd941","components/typography/MS/MS.prompt.md":"d409fd50a055","components/typography/MXS/MXS.jsx":"f28d0c1565e3","components/typography/MXS/MXS.d.ts":"e61d7cf73fd9","components/typography/MXS/MXS.prompt.md":"85d0ba2edde4","components/typography/P/P.jsx":"3a5c738ebafb","components/typography/P/P.d.ts":"932b9484307d","components/typography/P/P.prompt.md":"4e2604f7609a","components/jambonz-ui/Tabs/Tabs.jsx":"37f054004f86","components/jambonz-ui/Tabs/Tabs.d.ts":"cea5335ed12f","components/jambonz-ui/Tabs/Tabs.prompt.md":"ac68c394a3c5"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
"use strict";
var JambonzUiKit = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function np(p, k) {
        var o = {};
        for (var x in p) if (x !== "children") o[x] = p[x];
        if (k !== void 0) o.key = k;
        return o;
      }
      function jsx(t, p, k) {
        var c = p && p.children;
        return c === void 0 ? R.createElement(t, np(p, k)) : R.createElement(t, np(p, k), c);
      }
      function jsxs(t, p, k) {
        return R.createElement.apply(R, [t, np(p, k)].concat(p.children));
      }
      module.exports = R;
      module.exports.jsx = jsx;
      module.exports.jsxs = jsxs;
      module.exports.jsxDEV = function(t, p, k, s) {
        return (s ? jsxs : jsx)(t, p, k);
      };
      module.exports.Fragment = R.Fragment;
    }
  });

  // pkg/dist/esm/index.js
  var index_exports = {};
  __export(index_exports, {
    Button: () => Button,
    ButtonGroup: () => ButtonGroup,
    H1: () => H1,
    H2: () => H2,
    H3: () => H3,
    H4: () => H4,
    H5: () => H5,
    H6: () => H6,
    Icon: () => Icon,
    IconGroup: () => IconGroup,
    M: () => M,
    MS: () => MS,
    MXS: () => MXS,
    P: () => P,
    Tab: () => Tab,
    Tabs: () => Tabs,
    classNames: () => classNames,
    getCssVar: () => getCssVar
  });
  init_define_import_meta_env();

  // pkg/dist/esm/utils.js
  init_define_import_meta_env();
  var rootStyle;
  var classNames = (obj) => {
    return Object.keys(obj).filter((k) => obj[k] === true).join(" ");
  };
  var getCssVar = (prop) => {
    if (!rootStyle) {
      rootStyle = window.getComputedStyle(document.documentElement);
    }
    return rootStyle.getPropertyValue(prop);
  };

  // pkg/dist/esm/icon.js
  init_define_import_meta_env();
  var import_jsx_runtime = __toESM(require_react_shim());
  function Icon({ subStyle, mainStyle, ...rest }) {
    const classes = {
      ico: true
    };
    if (mainStyle) {
      classes[`ico--${mainStyle}`] = true;
    }
    if (subStyle) {
      classes[`ico--${subStyle}`] = true;
    }
    return (0, import_jsx_runtime.jsx)("div", { ...rest, className: classNames(classes) });
  }
  function IconGroup({ children, className = "" }) {
    const classes = {
      icos: true
    };
    if (className) {
      className.split(" ").forEach((c) => classes[c] = true);
    }
    return (0, import_jsx_runtime.jsx)("div", { className: classNames(classes), children });
  }

  // pkg/dist/esm/button.js
  init_define_import_meta_env();
  var import_jsx_runtime2 = __toESM(require_react_shim());
  function Button(props) {
    const { small = false, subStyle, mainStyle, ...restProps } = props;
    const classes = {
      btn: true
    };
    if (mainStyle) {
      classes[`btn--${mainStyle}`] = true;
    }
    if (subStyle) {
      classes[`btn--${subStyle}`] = true;
    }
    if (small) {
      classes["btn--small"] = true;
    }
    if ("to" in restProps) {
      const { as: Link, to, ...rest } = restProps;
      return (0, import_jsx_runtime2.jsx)(Link, { ...rest, to, className: classNames(classes) });
    }
    if ("href" in restProps) {
      const { as: Link, href, children, ...rest } = restProps;
      return (0, import_jsx_runtime2.jsx)(Link, { href, children: (0, import_jsx_runtime2.jsx)("a", { ...rest, className: classNames(classes), children }) });
    }
    return (0, import_jsx_runtime2.jsx)("button", { ...restProps, className: classNames(classes) });
  }
  function ButtonGroup({ left = false, right = false, children, className = "" }) {
    const classes = {
      btns: true
    };
    if (left) {
      classes["btns--left"] = true;
    } else if (right) {
      classes["btns--right"] = true;
    }
    if (className) {
      className.split(" ").forEach((c) => classes[c] = true);
    }
    return (0, import_jsx_runtime2.jsx)("div", { className: classNames(classes), children });
  }

  // pkg/dist/esm/typography.js
  init_define_import_meta_env();
  var import_jsx_runtime3 = __toESM(require_react_shim());
  function H1({ children, ...rest }) {
    return (0, import_jsx_runtime3.jsx)("h1", { ...rest, children });
  }
  function H2({ children, ...rest }) {
    return (0, import_jsx_runtime3.jsx)("h2", { ...rest, children });
  }
  function H3({ children, ...rest }) {
    return (0, import_jsx_runtime3.jsx)("h3", { ...rest, children });
  }
  function H4({ children, ...rest }) {
    return (0, import_jsx_runtime3.jsx)("h4", { ...rest, children });
  }
  function H5({ children, ...rest }) {
    return (0, import_jsx_runtime3.jsx)("h5", { ...rest, children });
  }
  function H6({ children, ...rest }) {
    return (0, import_jsx_runtime3.jsx)("h6", { ...rest, children });
  }
  function P({ children, ...rest }) {
    return (0, import_jsx_runtime3.jsx)("p", { ...rest, children });
  }
  function M({ children, className = "m", ...rest }) {
    return (0, import_jsx_runtime3.jsx)("div", { ...rest, className, children });
  }
  function MS(props) {
    return (0, import_jsx_runtime3.jsx)(M, { ...props, className: "ms" });
  }
  function MXS(props) {
    return (0, import_jsx_runtime3.jsx)(M, { ...props, className: "mxs" });
  }

  // pkg/dist/esm/tabs.js
  init_define_import_meta_env();
  var import_jsx_runtime4 = __toESM(require_react_shim());
  var import_react = __toESM(require_react_shim());
  function Tab({ children }) {
    return children;
  }
  function Tabs({ children, active: [activeTab, setActiveTab] }) {
    const [button, setButton] = (0, import_react.useState)(null);
    (0, import_react.useEffect)(() => {
      if (setActiveTab) {
        setActiveTab(children[0].props.id);
      }
    }, []);
    return (0, import_jsx_runtime4.jsxs)("div", { className: "tabs", children: [(0, import_jsx_runtime4.jsxs)("nav", { className: "tabs__nav", children: [import_react.default.Children.map(children, (child) => {
      const classes = {
        tabs__nav__item: true,
        active: activeTab === child.props.id
      };
      return (0, import_jsx_runtime4.jsx)("button", { type: "button", className: classNames(classes), onClick: () => {
        setActiveTab(child.props.id);
      }, ref: (element) => {
        if (activeTab === child.props.id) {
          setButton(element);
        }
      }, children: child.props.label });
    }), (0, import_jsx_runtime4.jsx)("div", { className: "tabs__active", style: {
      width: `${button?.clientWidth}px`,
      transform: `translate3d(${button?.offsetLeft}px, 0, 0)`
    } })] }), (0, import_jsx_runtime4.jsx)("div", { className: "tabs__tabs", children: import_react.default.Children.map(children, (child) => {
      const classes = {
        tabs__tabs__item: true,
        active: activeTab === child.props.id
      };
      return (0, import_jsx_runtime4.jsx)("div", { className: classNames(classes), children: (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: child.props.children }) });
    }) })] });
  }
  return __toCommonJS(index_exports);
})();
window.JambonzUiKit=JambonzUiKit.__dsMainNs?Object.assign({},JambonzUiKit,JambonzUiKit.__dsMainNs,{__dsMainNs:undefined}):JambonzUiKit;
