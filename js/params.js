// js/params.js

class ParamController {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
        this.params = {};
        this.schema = {};
    }

    buildUI(schema) {
        this.schema = schema || {};
        this.container.innerHTML = "";
        this.params = {};

        // Initialize default values
        for (const key in this.schema) {
            this.params[key] = this.schema[key].default;
        }

        // Notify app of initial params
        this.app.updateParams(this.params);

        // Create UI elements
        for (const key in this.schema) {
            const def = this.schema[key];
            const wrapper = document.createElement("div");
            wrapper.className = "param-item";

            const label = document.createElement("label");
            label.textContent = def.label || key;
            wrapper.appendChild(label);

            let input;

            if (def.type === "number") {
                input = document.createElement("input");
                input.type = "range";
                input.min = def.min !== undefined ? def.min : 0;
                input.max = def.max !== undefined ? def.max : 100;
                input.step = def.step || 1;
                input.value = def.default;

                const valDisplay = document.createElement("span");
                valDisplay.textContent = def.default;
                valDisplay.style.marginLeft = "10px";

                input.addEventListener("input", (e) => {
                    const val = parseFloat(e.target.value);
                    this.params[key] = val;
                    valDisplay.textContent = val;
                    this.app.updateParams(this.params);
                });

                wrapper.appendChild(input);
                wrapper.appendChild(valDisplay);
            }
            else if (def.type === "color") {
                input = document.createElement("input");
                input.type = "color";
                input.value = def.default;

                input.addEventListener("input", (e) => {
                    this.params[key] = e.target.value;
                    this.app.updateParams(this.params);
                });

                wrapper.appendChild(input);
            }
            else if (def.type === "string") {
                input = document.createElement("input");
                input.type = "text";
                input.value = def.default;

                input.addEventListener("input", (e) => {
                    this.params[key] = e.target.value;
                    this.app.updateParams(this.params);
                });

                wrapper.appendChild(input);
            }
            else if (def.type === "image") {
                input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";

                input.addEventListener("change", (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            // Load image into p5 and update params
                            this.app.loadImageParam(key, evt.target.result);
                        };
                        reader.readAsDataURL(file);
                    }
                });

                wrapper.appendChild(input);
            }

            this.container.appendChild(wrapper);
        }
    }
}
