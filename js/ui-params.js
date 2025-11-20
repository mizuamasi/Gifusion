class ParamController {
    constructor(containerEl, onChangeCallback) {
        this.container = containerEl;
        this.onChange = onChangeCallback;
        this.currentParams = {};
    }

    clear() {
        this.container.innerHTML = '';
        this.currentParams = {};
    }

    buildUI(schema, initialValues = {}) {
        this.clear();
        if (!schema) return;

        // 初期値をセット
        Object.keys(schema).forEach(key => {
            const def = schema[key];
            // initialValuesにあればそれ、なければschemaのdefault、それもなければ適当な値
            let val = initialValues[key] !== undefined ? initialValues[key] : def.default;
            this.currentParams[key] = val;
        });

        // UI生成
        Object.keys(schema).forEach(key => {
            const def = schema[key];
            const wrapper = document.createElement('div');
            wrapper.className = 'param-row';
            wrapper.style.marginBottom = '8px';

            const label = document.createElement('label');
            label.textContent = key + ': ';
            label.style.display = 'inline-block';
            label.style.width = '80px';

            wrapper.appendChild(label);

            if (def.type === 'number') {
                const input = document.createElement('input');
                input.type = 'range';
                input.min = def.min;
                input.max = def.max;
                input.step = def.step || 0.1;
                input.value = this.currentParams[key];

                const valDisplay = document.createElement('span');
                valDisplay.textContent = input.value;
                valDisplay.style.marginLeft = '8px';

                input.addEventListener('input', (e) => {
                    const v = parseFloat(e.target.value);
                    this.currentParams[key] = v;
                    valDisplay.textContent = v;
                    this.onChange(this.currentParams);
                });

                wrapper.appendChild(input);
                wrapper.appendChild(valDisplay);

            } else if (def.type === 'string') {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = this.currentParams[key];

                input.addEventListener('input', (e) => {
                    this.currentParams[key] = e.target.value;
                    this.onChange(this.currentParams);
                });

                wrapper.appendChild(input);

            } else if (def.type === 'boolean') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = !!this.currentParams[key];

                input.addEventListener('change', (e) => {
                    this.currentParams[key] = e.target.checked;
                    this.onChange(this.currentParams);
                });

                wrapper.appendChild(input);
            }

            this.container.appendChild(wrapper);
        });

        // 初回通知
        this.onChange(this.currentParams);
    }

    getParams() {
        return { ...this.currentParams };
    }
}
