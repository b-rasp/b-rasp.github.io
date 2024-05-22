class BRASP {
    constructor() {
        this.operations = [];
        this.operation_names = [];
    }

    // Method to add a new boolean operation
    addOperation(operation) {
        this.operations.push(operation);
    }

    // Method to remove an operation
    removeOperation(operation) {
        this.operations = this.operations.filter(op => op !== operation);
    }

    // Method to remove an operation by name
    removeOperationByName(name) {
        this.operations = this.operations.filter(op => op.name !== name);
    }

    clearOperations() {
        this.operations = [];
    }

    // Method to get the list of operations
    getOperations() {
        return this.operations;
    }

    // Method to get the list of operation names
    getOperationNames() {
        return this.operations.map(op => op.name);
    }

    // Method to execute the operations on an input
    execute(input) {
        // Make sure input is a list of strings
        if (!Array.isArray(input)) {
            throw new Error('Input must be a list of strings');
        }
        // get length of input
        let n = input.length;

        // create a dictionary to store the trace of each operation over the input
        let trace = {};

        // iterate over all operations
        for (let operation of this.operations) {
            // check if operation is an initial operation
            if (operation instanceof InitialOperation) {
                // check if the symbol is in the input
                let symbol = operation.symbol;
                let my_trace = [];
                // iterate over the input
                // if the input has symbol at position i, set trace[i]=1, otherwise set trace[i]=0
                for (let i = 0; i < n; i++) {
                    if (input[i] === symbol) {
                        my_trace.push(1);
                    } else {
                        my_trace.push(0);
                    }
                }

                // add the trace to the dictionary
                trace[operation.name] = my_trace;
            }
            if (operation instanceof BooleanOperation) {
                // check if the variables in the expression are in the trace
                let variables = operation.variables;
                let functions = operation.functions;
                let expression = operation.expression;
                let my_trace = [];
                let scope = {};
                // set each function in the expression to use the according operation
                for (let j = 0; j < functions.length; j++) {
                    let function_name = functions[j];
                    let function_operation = trace[function_name];
                    scope[function_name] = function_operation;
                }
                for (let i = 0; i < n; i++) {
                    let localScope = {};
                    for (let functionName in scope) {
                        localScope[functionName] = scope[functionName][i];
                    }
                    expression = expression.replace(/([a-zA-Z0-9_]+)\s*\(\s*i\s*\)/g, '$1');
                    let result = math.evaluate(expression, localScope);
                    my_trace.push(result);
                }
                trace[operation.name] = my_trace;
            }
            if (operation instanceof AttentionOperation) {
                let score_expression = operation.score_expression;
                let value_expression = operation.value_expression;
                let default_expression = operation.default_expression;
                let mask = operation.mask;
                let tie = operation.tie;
                let functions = operation.functions;
                let my_trace = [];
                let scope = {};
                // set each function in the expression to use the according operation
                for (let j = 0; j < functions.length; j++) {
                    let function_name = functions[j];
                    let function_operation = trace[function_name];
                    scope[function_name] = function_operation;
                }


                // first append the mask to the score expression
                score_expression = "(" + score_expression + ") & (" + mask + ")";
                // take care since some functions take i as input and some take j
                // use regex to replace f(i) with f_i and f(j) with f_j

                score_expression = score_expression.replace(/([a-zA-Z0-9_]+)\s*\(\s*i\s*\)/g, '$1_i').replace(/([a-zA-Z0-9_]+)\s*\(\s*j\s*\)/g, '$1_j');

                value_expression = value_expression.replace(/([a-zA-Z0-9_]+)\s*\(\s*i\s*\)/g, '$1_i').replace(/([a-zA-Z0-9_]+)\s*\(\s*j\s*\)/g, '$1_j');

                default_expression = default_expression.replace(/([a-zA-Z0-9_]+)\s*\(\s*i\s*\)/g, '$1_i');

                // iterate over the input
                for (let i = 0; i < n; i++) {
                    // first iterate over all j and calculate the score
                    // use the localscope trick to evaluate the score expression
                    // take care since some functions take i as input and some take j
                    // replace f_j with f[j] and f_i with f[i]
                    let scores = [];
                    for (let j = 0; j < n; j++) {
                        let localScope = {};
                        for (let functionName in scope) {
                            localScope[functionName + "_i"] = scope[functionName][i];
                            localScope[functionName + "_j"] = scope[functionName][j];
                        }
                        // add j and i to the local scope
                        localScope['i'] = i;
                        localScope['j'] = j;
                        let score = math.evaluate(score_expression, localScope);
                        scores.push(score);
                    }
                    // check if all scores are 0
                    let allZero = true;
                    for (let score of scores) {
                        if (score !== 0) {
                            allZero = false;
                        }
                    }

                    // if all scores are 0, use the default expression
                    if (allZero) {
                        let localScope = {};
                        for (let functionName in scope) {
                            localScope[functionName + "_i"] = scope[functionName][i];
                        }
                        localScope['i'] = i;
                        let value = math.evaluate(default_expression, localScope);
                        my_trace.push(value);
                    }
                    else {
                        // if the tie is leftmost, let j be the leftmost index with a score of 1
                        let j = i;
                        if (tie === "leftmost") {
                            for (let k = 0; k < n; k++) {
                                if (scores[k] === 1) {
                                    j = k;
                                    break;
                                }
                            }
                        }
                        // if the tie is rightmost, let j be the rightmost index with a score of 1
                        if (tie === "rightmost") {
                            for (let k = n - 1; k >= 0; k--) {
                                if (scores[k] === 1) {
                                    j = k;
                                    break;
                                }
                            }
                        }
                        let localScope = {};
                        for (let functionName in scope) {
                            localScope[functionName + "_i"] = scope[functionName][i];
                            localScope[functionName + "_j"] = scope[functionName][j];
                        }
                        localScope['i'] = i;
                        localScope['j'] = j;
                        let value = math.evaluate(value_expression, localScope);
                        my_trace.push(value);
                    }
                    trace[operation.name] = my_trace;
                }
            }
        }
        return trace;
    }
}


class InitialOperation {
    constructor(symbol) {
        // check that symbol is a single character
        if (symbol.length !== 1) {
            throw new Error('Symbol must be a single character');
        }
        this.name = "Q_" + symbol;
        this.symbol = symbol;
        this.color = "#FFCCCC";
        this.type = "initial";
        this.functions = [];
    }

    stringify() {
        return this.name + "(i)";
    }

    head() {
        return this.name + "(i)";
    }

    body() {
        return "";
    }
}

class BooleanOperation {
    constructor(name, expression) {
        // check using math.js parser if the expression is valid
        let variables = [];
        let functions = [];

        try {
            let node = math.parse(expression);

            node.traverse(function (node) {
                if (node.isSymbolNode) {
                    variables.push(node.name);
                }
                if (node.isFunctionNode) {
                    functions.push(node.fn.name);
                }
            });
            // make sure every variable in the expression is either i or a function name
            for (let variable of variables) {
                if (variable !== 'i' && !functions.includes(variable)) {
                    throw new Error('Too many variables');
                }
            }
        } catch (error) {
            throw new Error('Invalid expression');
        }
        this.name = name;
        this.expression = expression;
        this.variables = variables;
        this.functions = functions;
        this.color = "#C6EFFC";
        this.type = "boolean";
    }

    stringify() {
        return this.name + "(i) := " + this.expression;
    }

    head() {
        return this.name + "(i)";
    }

    body() {
        return this.expression;
    }
}

class AttentionOperation {
    constructor(name, tie, mask, score_expression, value_expression, default_expression) {
        this.name = name;
        // tie must be "leftmost" or "rightmost"
        if (tie !== "leftmost" && tie !== "rightmost") {
            throw new Error('Invalid tie');
        }
        this.tie = tie;
        // mask must be "j<i" or "i<j" or "j<=i" or "i<=j" or "1"
        if (mask !== "j<i" && mask !== "i<j" && mask !== "j<=i" && mask !== "i<=j" && mask !== "1") {
            throw new Error('Invalid mask');
        }
        this.mask = mask;
        // check using math.js parser if the expression is valid
        let score_variables = [];
        let score_functions = [];
        try {
            let node = math.parse(score_expression);
            node.traverse(function (node) {
                if (node.isSymbolNode) {
                    score_variables.push(node.name);
                }
                if (node.isFunctionNode) {
                    score_functions.push(node.fn.name);
                }
            });
            // the score expression cannot contain variables other than i and j and the functions
            for (let variable of score_variables) {
                if (variable !== 'i' && variable !== 'j' && !score_functions.includes(variable)) {
                    throw new Error('Too many variables');
                }
            }

        } catch (error) {
            throw new Error('Invalid score expression');
        }

        // check using math.js parser if the value expression is valid
        let value_variables = [];
        let value_functions = [];

        try {
            let node = math.parse(value_expression);

            node.traverse(function (node) {
                if (node.isSymbolNode) {
                    value_variables.push(node.name);
                }
                if (node.isFunctionNode) {
                    value_functions.push(node.fn.name);
                }
            });
            // the value expression cannot contain variables other than i and j and the functions
            for (let variable of value_variables) {
                if (variable !== 'i' && variable !== 'j' && !value_functions.includes(variable)) {
                    throw new Error('Too many variables');
                }
            }
        } catch (error) {
            throw new Error('Invalid value expression');
        }
        // check using math.js parser if the default expression is valid
        let default_variables = [];
        let default_functions = [];
        try {
            let node = math.parse(default_expression);

            node.traverse(function (node) {
                if (node.isSymbolNode) {
                    default_variables.push(node.name);
                }
                if (node.isFunctionNode) {
                    default_functions.push(node.fn.name);
                }
            });
            // the default expression cannot contain variables other than i and the functions
            for (let variable of default_variables) {
                if (variable !== 'i' && !default_functions.includes(variable)) {
                    throw new Error('Too many variables');
                }
            }
        } catch (error) {
            throw new Error('Invalid default expression');
        }
        this.score_expression = score_expression;
        this.score_variables = score_variables;
        this.score_functions = score_functions;

        this.value_expression = value_expression;
        this.value_variables = value_variables;
        this.value_functions = value_functions;

        this.default_expression = default_expression;
        this.default_variables = default_variables;
        this.default_functions = default_functions;

        this.functions = score_functions.concat(value_functions).concat(default_functions);
        this.color = "#ffe6cc";

        this.type = "attention";
    }

    stringify() {
        return this.name + "(i) := " + this.tie + " [" + this.mask + ", " + this.score_expression + "] " + this.value_expression + " : " + this.default_expression;
    }

    head() {
        return this.name + "(i)";
    }

    body() {
        return this.tie + " [" + this.mask + ", " + this.score_expression + "] " + this.value_expression + " : " + this.default_expression;
    }
}