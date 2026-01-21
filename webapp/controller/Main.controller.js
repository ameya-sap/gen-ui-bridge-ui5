sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("sap.ui.demo.stocktrack.controller.Main", {
    onInit: function () {
      // The model is set in the Component or Manifest in real apps, 
      // but for this task we might set it here if not using Component fully,
      // however the requirement says "Load products.json ... and set it to the view".
      // Since we will have a Component, we can set it there or here. 
      // The prompt asks to "Load the products.json ... and set it to the view" IN the controller section.
      // So we will do it here to strictly follow instructions, but usually Component handles models.

      var oModel = new JSONModel();
      oModel.loadData("model/products.json");
      // Actually better to use sap.ui.require.toUrl or relative to controller if mapped.
      // Let's assume standard structure relative to webapp root.
      this.getView().setModel(oModel);
    },

    onSearch: function (oEvent) {
      // add filter for search
      var aFilters = [];
      var sQuery = oEvent.getSource().getValue();
      if (sQuery && sQuery.length > 0) {
        var filter = new Filter("ProductName", FilterOperator.Contains, sQuery);
        aFilters.push(filter);
      }

      // update list binding
      var oTable = this.byId("productsTable");
      var oBinding = oTable.getBinding("items");
      oBinding.filter(aFilters);
    },

    onAskAI: function () {
      var oInput = this.byId("chatInput");
      var sQuestion = oInput.getValue();
      if (!sQuestion) {
        return;
      }

      // Clear input
      oInput.setValue("");

      // Show busy indicator or toast
      sap.m.MessageToast.show("Asking Agent...");

      // Call Backend ADK Agent
      // NOTE: In a real CopilotKit integration, we would use a WebSocket or the official client.
      // Here we simulate the specific "Sequence" requested by hitting the API directly 
      // and parsing the expected A2UI JSON.
      // CopilotKit standard endpoint usually handles a conversation history. 
      // We will do a simple POST for this demo to the /api/copilotkit/chat or similar if implied, 
      // but strict ADK agent usually expects a specific protocol. 
      // For this prototype, we'll assume a simplified /chat-like behavior or just standard POST.
      // However, the prompt asked to connect to `/api/copilotkit`. 
      // We will try a standard fetch to the agent. Because `ag_ui_adk` might expect a specific envelope,
      // we will simulate a simple interaction if the endpoint supports it, otherwise we might need to adjust.
      // Let's assume a direct POST with { "messages": [...] } is supported or we wrapper it.

      // Actually, `google-adk` + `ag_ui` usually implies a protocol. 
      // To make this robust without the React client, I'll assume we can just send the text prompt 
      // and get the text/JSON response back.

      var that = this;
      fetch("http://127.0.0.1:8001/api/copilotkit", { // Using 127.0.0.1 and port 8001 to avoid conflicts
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          threadId: "thread-" + Date.now(),
          runId: "run-" + Date.now(),
          state: {},
          tools: [],
          context: [], // Must be an array according to schema
          forwardedProps: {},
          messages: [
            {
              role: "user",
              content: sQuestion,
              id: "msg-" + Date.now()
            }
          ]
        })
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          return response.text();
        })
        .then(function (text) {
          console.log("Raw SSE Response:", text);

          // Parse SSE events
          // Format is data: {...}\n\n
          var lines = text.split("\n");
          var fullContent = "";

          lines.forEach(function (line) {
            if (line.startsWith("data: ")) {
              var jsonStr = line.substring(6).trim();
              if (jsonStr === "[DONE]") return;
              try {
                var event = JSON.parse(jsonStr);
                // Check event type from AG-UI protocol
                // Usually "text", "message", or "content"
                console.log("SSE Event:", event);

                if (event.type === "text" || event.type === "message") {
                  fullContent += event.content || "";
                } else if (event.type === "content") {
                  // Some implementers use this
                  fullContent += event.delta || event.content || "";
                } else if (event.type === "TEXT_MESSAGE_CONTENT") {
                  fullContent += event.delta || "";
                } else if (event.discriminator === "run_finished") {
                  // CopilotKit protocol might wrap it differently?
                  // Let's rely on accumulation.
                }
              } catch (e) {
                console.error("Error parsing SSE event:", e);
              }
            }
          });

          console.log("Accumulated Content:", fullContent);

          if (!fullContent) {
            sap.m.MessageToast.show("No content received from Agent.");
            return;
          }

          // Extract all JSON blocks
          var regex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
          var match;
          var aComponents = [];

          while ((match = regex.exec(fullContent)) !== null) {
            try {
              var oParsed = JSON.parse(match[1]);
              aComponents.push(oParsed);
            } catch (e) {
              console.error("Failed to parse block:", match[1]);
            }
          }

          // If no blocks found, try parsing the whole content as JSON (fallback)
          if (aComponents.length === 0) {
            try {
              // Clean potential leading/trailing non-json garbage if any, 
              // but straightforward parse is best first attempt
              var oParsed = JSON.parse(fullContent);
              aComponents.push(oParsed);
            } catch (e) {
              // Not JSON, plain text
            }
          }

          if (aComponents.length > 0) {
            console.log("Parsed A2UI Components:", aComponents);
            that.renderA2UI(aComponents);
          } else {
            // If not JSON, it's just plain text
            console.log("Content is plain text:", fullContent);
            sap.m.MessageToast.show(fullContent);
          }
        })
        .catch(function (err) {
          console.error("Agent Fetch Error:", err);
          sap.m.MessageToast.show("Error connecting to Agent. Check console.");
        });
    },

    renderA2UI: function (vA2UI) {
      // vA2UI can be a single object or an array of objects
      var aItems = Array.isArray(vA2UI) ? vA2UI : [vA2UI];

      var oView = this.getView();

      // Create a Dialog if not exists
      if (!this._oDialog) {
        this._oDialog = new sap.m.Dialog({
          title: "Agent Suggestion",
          content: [],
          beginButton: new sap.m.Button({
            text: "Close",
            press: function () {
              this._oDialog.close();
            }.bind(this)
          })
        });
        oView.addDependent(this._oDialog);
      }

      this._oDialog.destroyContent();

      aItems.forEach(function (oA2UI) {
        var oControl;
        if (oA2UI.component === "ProductCard") {
          oControl = new sap.m.VBox({
            items: [
              new sap.m.ObjectHeader({
                title: oA2UI.props.title,
                intro: oA2UI.props.description,
                number: oA2UI.props.price,
                statuses: [
                  new sap.m.ObjectStatus({
                    text: oA2UI.props.stockStatus,
                    state: oA2UI.props.stockStatus // Assuming text matches State enum (Success/Warning/Error)
                  })
                ]
              })
            ]
          }).addStyleClass("sapUiSmallMargin"); // Add some spacing
        } else if (oA2UI.component === "ProductAlert") {
          oControl = new sap.m.MessageStrip({
            text: oA2UI.props.text,
            type: oA2UI.props.level,
            showIcon: true
          }).addStyleClass("sapUiSmallMargin");
        } else {
          // If it's just text or unhandled component
          oControl = new sap.m.Text({ text: "Unknown component or text: " + (oA2UI.component || JSON.stringify(oA2UI)) });
        }
        this._oDialog.addContent(oControl);
      }.bind(this));

      this._oDialog.open();
    },

    // Optional formatter if we wanted to format the stock text, 
    // but the requirements just said map State to status color.
    // I added a formatter in XML for text just to be safe (display Quantity), 
    // but let's stick to simple binding for the text property if strictly following "Stock Level" column description.
    // "Use sap.m.ObjectStatus. Use data binding to map the State property to the status color."
    formatStockValue: function (fValue) {
      return fValue + " Units";
    }
  });
});
