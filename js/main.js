// Storage keys
const profilesKey = "profiles";
const importedHashesKey = "imported_hashes"; // Key for storing imported URL hashes

function sanitize(s) {
  return s
    .split("")
    .map((char) => {
      // Regex tests for valid id characters
      return /^[A-Za-z0-9\-_]$/.test(char) ? char : "_";
    })
    .join("");
}

function generateTasks() {
  let markdownString = "";

  // Try to load custom checklist from localStorage first
  const currentProfile = getCurrentProfile();
  if (currentProfile && currentProfile.checklistContent) {
    processMarkdown(currentProfile.checklistContent);
    // Also populate the editor
    document.getElementById("checklist-content").value = currentProfile.checklistContent;
    return;
  }

  // If no custom checklist exists, show a default getting started checklist
  const defaultChecklist = "# Getting Started\n- ::task:: Welcome to the Custom Checklist Tool! Create your first checklist by going to the \"Create/Edit List\" tab.";
  processMarkdown(defaultChecklist);
  // Also populate the editor with a starter example
  document.getElementById("checklist-content").value = "# Example Category\n- ::task:: Regular task item\n- ::missable:: Urgent task item\n- ::item_uncommon:: Special item\n- ::item_story:: Important note\n- ::task:: Task with [link to example](https://example.com)\n\n# Shopping List\n- ::task:: Buy groceries\n  - ::task:: Milk\n  - ::task:: Eggs\n  - ::missable:: Fresh bread (expires soon!)\n\n# Work Tasks\n- ::task:: Complete project report\n- ::missable:: Submit timesheet by Friday\n- ::task:: Check [company policies](https://example.com/policies)";
}

function processMarkdown(markdownString) {
  const lines = markdownString.split("\n");
  let htmlOutput = "";

  for (let i = 0; i < lines.length; i++) {
    // Remove leading and trailing spaces from the line
    let line = lines[i] ? lines[i].trim() : "";

    // Skip empty lines
    if (line === "") {
      continue;
    }

    // Calculate indentation level; 1 tab or 2 spaces equals 1 level
    const level = lines[i].match(/^(?:\t| {2})*/)[0].length;

    // Check if the line starts with '# ' indicating a header
    if (line.startsWith("# ")) {
      const headerText = line.substr(2);
      const idText = sanitize(headerText);
      htmlOutput += `</ul><h3 id="${idText}"><a href="#" data-toggle="collapse" data-parent="#tabPlaythrough" class="btn btn-primary btn-collapse btn-sm"></a><a href="#">${headerText}</a></h3>\n`;
      htmlOutput += '<ul class="panel-collapse collapse in">\n';
    }
    // Check if the line starts with '- ' indicating a list item (main or sub-bullet based on indentation)
    else if (line.startsWith("- ") || /^(\t| {2})+\- /.test(lines[i])) {
      // Extract the text after '- ' and trim any leading/trailing spaces
      let listItemText = line.substr(2).trim();

      // If there's no icon, default to ::task::
      if (!listItemText.includes("::")) {
        listItemText = "::task::" + listItemText;
      }

      // Replace ::missable:: with a clock icon, ::item:: with the gem icon, ::ability:: with mortarboard icon, and ::task::, if present or added above
      listItemText = listItemText.replace(
        /::missable::\s*/g,
        '<i class="bi bi-stopwatch text-danger"></i>'
      );
      // Remove unused item types
      listItemText = listItemText.replace(
        /::item_uncommon::\s*/g,
        '<i class="bi bi-gem text-success"></i>'
      );
      listItemText = listItemText.replace(
        /::item_story::\s*/g,
        '<i class="bi bi-book text-danger"></i>'
      );
      listItemText = listItemText.replace(
        /::task::\s*/g,
        '<i class="bi bi-clipboard-check"></i>'
      );

      // Convert markdown bold syntax to HTML
      listItemText = listItemText.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

      // Check if there's an item with an unintentional parenthesis at the start
      // This pattern matches items that start with a closing parenthesis followed by text
      const orphanedParenPattern = /^(<i class="bi [^>]+><\/i>)\)\s*(.*)/;
      const orphanedParenMatch = listItemText.match(orphanedParenPattern);
      if (orphanedParenMatch) {
        // Fix the format by removing the orphaned parenthesis
        listItemText = `${orphanedParenMatch[1]}${orphanedParenMatch[2]}`;
      }

      // Convert markdown-style links to HTML links
      let processedText = '';
      let lastIndex = 0;
      let currentText = listItemText;

      while (true) {
        const openBracketIndex = currentText.indexOf('[', lastIndex);
        if (openBracketIndex === -1) {
          // No more opening brackets found, append the rest of the text
          processedText += currentText.substring(lastIndex);
          break;
        }

        // Append text before the potential link
        processedText += currentText.substring(lastIndex, openBracketIndex);

        // Find the matching closing bracket for the link text
        let bracketDepth = 1;
        let closeBracketIndex = -1;
        for (let i = openBracketIndex + 1; i < currentText.length; i++) {
          if (currentText[i] === '[') {
            bracketDepth++;
          } else if (currentText[i] === ']') {
            bracketDepth--;
            if (bracketDepth === 0) {
              closeBracketIndex = i;
              break;
            }
          }
        }

        // Check if a matching bracket was found and if it's followed by '('
        if (closeBracketIndex !== -1 && currentText[closeBracketIndex + 1] === '(') {
          // Found the structure of a potential link: [text](...)

          // Find the matching closing parenthesis for the URL
          let parenDepth = 1;
          let urlEndIndex = -1;
          const urlStartIndex = closeBracketIndex + 2;
          for (let i = urlStartIndex; i < currentText.length; i++) {
            if (currentText[i] === '(') {
              parenDepth++;
            } else if (currentText[i] === ')') {
              parenDepth--;
              if (parenDepth === 0) {
                urlEndIndex = i;
                break;
              }
            }
          }

          if (urlEndIndex !== -1) {
            // Valid link found!
            const linkText = currentText.substring(openBracketIndex + 1, closeBracketIndex);
            const url = currentText.substring(urlStartIndex, urlEndIndex);

            // Append the HTML link
            processedText += `<a href="${url}" target="_blank">${linkText}</a>`;
            lastIndex = urlEndIndex + 1; // Move past the processed link
          } else {
            // Malformed link (missing closing parenthesis for URL), treat as plain text
            processedText += currentText.substring(openBracketIndex, urlStartIndex); // Append '[text]('
            lastIndex = urlStartIndex;
          }
        } else {
          // Not a link structure, treat the opening bracket as plain text
          processedText += '[';
          lastIndex = openBracketIndex + 1;
        }
      }

      listItemText = processedText; // Update listItemText with processed links

      // Also check for orphaned closing parentheses after links have been processed
      listItemText = listItemText.replace(/(<\/a>)\)/g, '$1');

      // Generate a unique ID for the item, starting by preparing a slice without the HTML tags, or else the ID may only get the first 50 characters of HTML (so it won't be unique)
      const listItemTextWithoutTags = listItemText.replace(
        /(<([^>]+)>)/gi,
        ""
      );
      const uuid = sanitize(listItemTextWithoutTags.slice(0, 50)); // Extract only the first 50 characters of the text without HTML tags

      // If the bullet is a top-level bullet (i.e., not indented)
      if (level === 0) {
        htmlOutput += `<li data-id="playthrough_${uuid}">${listItemText}\n`;
      }
      // If the bullet is an indented sub-bullet
      else {
        // If the previous line was not a sub-bullet, begin a new nested list
        if (i === 0 || /^(\t| {2})+\- /.test(lines[i - 1]) === false) {
          htmlOutput += `<ul class="panel-collapse collapse in">\n`;
        }

        // Append the sub-bullet to the output
        htmlOutput += `<li data-id="playthrough_${uuid}">${listItemText}</li>\n`;

        // If the next line is not a sub-bullet, end the nested list
        if (
          i === lines.length - 1 ||
          /^(\t| {2})+\- /.test(lines[i + 1]) === false
        ) {
          htmlOutput += `</ul>\n`;
        }
      }
    }
  }

  // If the last line of the output is a list item, close the list
  if (htmlOutput.endsWith("</li>\n")) {
    htmlOutput += "</ul>\n";
  }

  // Get the container for the converted content and update its innerHTML
  const playthroughDiv = document.getElementById("tabPlaythrough");
  if (playthroughDiv) {
    // Clear existing content except for the title and table of contents
    const title = playthroughDiv.querySelector("h2");
    const toc = playthroughDiv.querySelector(".table_of_contents");
    const hr = playthroughDiv.querySelector("hr");

    // Remove all elements after the hr
    let nextElement = hr.nextElementSibling;
    while (nextElement) {
      const elementToRemove = nextElement;
      nextElement = nextElement.nextElementSibling;
      elementToRemove.remove();
    }

    // Add the new content
    playthroughDiv.innerHTML += htmlOutput;
  }

  // Find any task (li) UUIDs that are duplicated, and asynchronously append the number of times they appear above themselves
  // This should be deterministic, so the same UUIDs should always have the same number appended
  let listItems = document.querySelectorAll("li[data-id]");
  let listItemsArray = Array.from(listItems);
  let shadowArray = listItemsArray.slice();

  listItemsArray.forEach((listItem) => {
    // Get the UUID from the data-id attribute
    let uuid = listItem.getAttribute("data-id").replace("playthrough_", "");

    // Get the index of the current li element in the shadow array
    let index = shadowArray.indexOf(listItem);

    // Get the number of occurrences of the UUID above the current li element in the shadow array
    let occurrences = shadowArray.slice(0, index).filter((item) => {
      return item.getAttribute("data-id").includes(uuid);
    }).length;

    // If there are any occurrences, append the number of occurrences to the end of the data-id
    if (occurrences > 0) {
      listItem.setAttribute(
        "data-id",
        listItem.getAttribute("data-id") + "_" + occurrences
      );
    }
  });

  // Run additional functions
  createTableOfContents();
  setUlIdAndSpanIdFromH3();
  addCheckboxes();

  // Set a recurring timer to watch headers with all subtasks completed
  setInterval(watchEmptyHeaders, 250);
}

// If hide completed is checked, hide the headers with no subtasks remaining
function watchEmptyHeaders() {
  // If an h3's span has a class of in_progress, show the header
  $("h3 > span.in_progress").each(function () {
    $(this).parent().show();
  });
  // if hide completed is not checked, unhide all and return
  if (!$("body").hasClass("hide_completed")) {
    $("h3 > span.done").each(function () {
      $(this).parent().show();
    });
    return;
  }
  // If an h3's span has a class of done, hide the header
  $("h3 > span.done").each(function () {
    $(this).parent().hide();
  });
}

function setUlIdAndSpanIdFromH3() {
  // Get all h3 elements with an ID
  let headings = document.querySelectorAll("h3[id]");
  let counter = 1; // Initialize the counter

  headings.forEach((heading) => {
    // For setting the ul's id
    let ul = heading.nextElementSibling;
    if (ul && ul.tagName === "UL") {
      let newId = heading.id + "_col";
      ul.id = newId;

      let aTag = heading.querySelector('a[data-toggle="collapse"]');
      if (aTag) {
        aTag.setAttribute("href", `#${newId}`);
      }
    }

    // Look for the "Collapse All" button
    let collapseAllBtn = document.querySelector("#toggleCollapseAll");
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener("click", function (e) {
        e.preventDefault();

        // Toggle the icon display
        const downIcon = collapseAllBtn.querySelector('.glyphicon-chevron-down');
        const upIcon = collapseAllBtn.querySelector('.glyphicon-chevron-up');

        if (downIcon.style.display !== 'none') {
          // If down icon is visible, switch to up icon and collapse all
          downIcon.style.display = 'none';
          upIcon.style.display = 'inline-block';

          // Collapse all sections
          document.querySelectorAll("h3[id] + ul").forEach((ul) => {
            $(ul).collapse("hide");
          });
        } else {
          // If up icon is visible, switch to down icon and expand all
          downIcon.style.display = 'inline-block';
          upIcon.style.display = 'none';

          // Expand all sections
          document.querySelectorAll("h3[id] + ul").forEach((ul) => {
            $(ul).collapse("show");
          });
        }
      });
    }
  });
}

function addCheckboxes() {
  // Make each list item clickable instead of adding separate checkboxes
  $("li[data-id]").each(function () {
    var $el = $(this);
    var dataId = $el.attr("data-id");

    // Set initial state from storage
    var currentProfile = getCurrentProfile();
    if (currentProfile && currentProfile.checklistData && currentProfile.checklistData[dataId]) {
      $el.addClass("completed");
    }

    // Add click event to the entire list item instead of a checkbox
    $el.css("cursor", "pointer").on("click", function (e) {
      // Don't trigger click when clicking on links within items
      if ($(e.target).is('a') || $(e.target).parents('a').length) {
        return;
      }

      var currentProfile = getCurrentProfile();
      if (!currentProfile.checklistData) {
        currentProfile.checklistData = {};
      }

      // Toggle completed state
      if ($el.hasClass("completed")) {
        $el.removeClass("completed");
        delete currentProfile.checklistData[dataId];
      } else {
        $el.addClass("completed");
        currentProfile.checklistData[dataId] = true;
      }

      // Save to storage
      saveCurrentProfile(currentProfile);

      // Update totals
      calculateTotals();

      // Stop event propagation to prevent parent list items from being toggled
      e.stopPropagation();
    });
  });

  // Calculate initial totals
  calculateTotals();
}

function calculateTotals() {
  // Calculate and update category totals
  $("h3[id]").each(function () {
    var $category = $(this);
    var $items = $category.next("ul").find("li[data-id]").not("li[data-id] li[data-id]");
    var total = $items.length;
    var completed = $items.filter(".completed").length;

    var $span = $category.find("span.category_total");
    if ($span.length === 0) {
      $span = $("<span>").addClass("category_total");
      $category.append($span);
    }

    $span.text(" - " + completed + "/" + total);

    if (completed === total && total > 0) {
      $span.removeClass("in_progress").addClass("done");
    } else if (completed > 0) {
      $span.removeClass("done").addClass("in_progress");
    } else {
      $span.removeClass("done in_progress");
    }
  });

  // Calculate and update overall total
  var $items = $("li[data-id]").not("li[data-id] li[data-id]");
  var total = $items.length;
  var completed = $items.filter(".completed").length;

  $("#playthrough_overall_total").text(" - " + completed + "/" + total);
}

// Profile management functions

function getCurrentProfile() {
  const profiles = $.jStorage.get(profilesKey, {});
  const profileId = $.jStorage.get("current_profile", null);

  if (!profileId || !profiles[profileId]) {
    // If no profiles exist, create a default one with timestamp
    const { uniqueName, uniqueId } = generateUniqueProfileName("Default", profiles);

    profiles[uniqueId] = {
      id: uniqueId,
      name: uniqueName,
      checklistData: {},
      checklistContent: "# Getting Started\n- ::task:: Welcome! This is your first checklist. Go to the \"Create/Edit List\" tab to customize it."
    };

    $.jStorage.set(profilesKey, profiles);
    $.jStorage.set("current_profile", uniqueId);
    console.log("Created timestamped default profile:", uniqueId);
    return profiles[uniqueId];
  }

  return profiles[profileId];
}

function saveCurrentProfile(profile) {
  const profiles = $.jStorage.get(profilesKey, {});
  profiles[profile.id] = profile;
  $.jStorage.set(profilesKey, profiles);
}

// Function to generate a unique profile ID and name
function generateUniqueProfileName(baseName, profiles) {
  const now = new Date();
  const dateString = now.toLocaleDateString();
  const timeString = now.toLocaleTimeString();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');

  // Always include Date and Time for generated profiles
  const finalName = `${baseName} ${dateString} ${timeString}`;

  // Generate a unique ID using the base name and timestamp
  const uniqueId = `${baseName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`;

  return { uniqueName: finalName, uniqueId: uniqueId };
}

function populateProfiles() {
  const profiles = $.jStorage.get(profilesKey, {});
  const currentProfileId = $.jStorage.get("current_profile", null);

  const $select = $("#profiles");
  $select.empty();

  Object.values(profiles).forEach(profile => {
    const $option = $("<option>").val(profile.id).text(profile.name);
    if (profile.id === currentProfileId) {
      $option.prop("selected", true);
    }
    $select.append($option);
  });

  // If no profiles exist, do nothing here (default is created in getCurrentProfile if needed)
}

function initializeProfileFunctionality($) {
  // Populate profiles on page load
  populateProfiles();

  // Handle profile selection change
  $("#profiles").on("change", function () {
    const profileId = $(this).val();
    $.jStorage.set("current_profile", profileId);

    // Reload the checklist with the selected profile
    generateTasks();
  });

  // Add profile button
  $("#profileAdd").on("click", function () {
    $("#profileModalTitle").text("Add Profile");
    $("#profileModalName").val("");
    $("#profileModalAdd").show();
    $("#profileModalUpdate, #profileModalDelete").hide();
    $("#profileModal").modal("show");
  });

  // Edit profile button
  $("#profileEdit").on("click", function () {
    const currentProfile = getCurrentProfile();

    $("#profileModalTitle").text("Edit Profile");
    $("#profileModalName").val(currentProfile.name);
    $("#profileModalAdd").hide();
    $("#profileModalUpdate, #profileModalDelete").show();
    $("#profileModal").modal("show");
  });

  // Add profile action
  $("#profileModalAdd").on("click", function () {
    const profileName = $("#profileModalName").val().trim();
    if (!profileName) return;

    const profiles = $.jStorage.get(profilesKey, {});

    const { uniqueName, uniqueId } = generateUniqueProfileName(profileName, profiles);

    profiles[uniqueId] = {
      id: uniqueId,
      name: uniqueName,
      checklistData: {},
      checklistContent: "# Getting Started\n- ::task:: Welcome to the Custom Checklist Tool! Create your first checklist by going to the \"Create/Edit List\" tab."
    };

    $.jStorage.set(profilesKey, profiles);
    $.jStorage.set("current_profile", uniqueId);

    populateProfiles();
    generateTasks();
  });

  // Update profile action
  $("#profileModalUpdate").on("click", function () {
    const profileName = $("#profileModalName").val().trim();
    if (!profileName) return;

    const currentProfileId = $.jStorage.get("current_profile", null);
    const profiles = $.jStorage.get(profilesKey, {});

    if (currentProfileId && profiles[currentProfileId]) {
      profiles[currentProfileId].name = profileName;
      $.jStorage.set(profilesKey, profiles);

      populateProfiles();
      $("#profileModal").modal("hide");
    }
  });

  // Delete profile action
  $("#profileModalDelete").on("click", function () {
    // Create custom modal for confirmation
    const confirmModal = `
      <div class="modal fade" id="confirmDeleteModal" tabindex="-1" role="dialog" aria-labelledby="confirmDeleteModalLabel">
        <div class="modal-dialog modal-confirm" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h4 class="modal-title" id="confirmDeleteModalLabel">Confirm Delete</h4>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <p>Are you sure you want to delete this profile? This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove any existing modal
    $("#confirmDeleteModal").remove();

    // Add modal to body
    $("body").append(confirmModal);

    // Show modal
    $("#confirmDeleteModal").modal("show");

    // Handle delete confirmation
    $("#confirmDeleteBtn").on("click", function () {
      const currentProfileId = $.jStorage.get("current_profile", null);
      const profiles = $.jStorage.get(profilesKey, {});

      if (currentProfileId && profiles[currentProfileId]) {
        // Get the hash before deleting the profile
        const hashToDelete = profiles[currentProfileId].importHash;

        // Delete the profile object
        delete profiles[currentProfileId];
        $.jStorage.set(profilesKey, profiles);

        // If a hash was associated, remove it from the imported list
        if (hashToDelete) {
          let importedHashes = $.jStorage.get(importedHashesKey, []);
          importedHashes = importedHashes.filter(h => h !== hashToDelete);
          $.jStorage.set(importedHashesKey, importedHashes);
          console.log("Removed hash from imported list:", hashToDelete);
        }

        // Set current profile to the first available one
        const firstProfileId = Object.keys(profiles)[0];
        if (firstProfileId) {
          $.jStorage.set("current_profile", firstProfileId);
        } else {
          // If no profiles left, create a default one with timestamp
          const { uniqueName, uniqueId } = generateUniqueProfileName("Default", profiles);

          profiles[uniqueId] = {
            id: uniqueId,
            name: uniqueName,
            checklistData: {},
            checklistContent: "# Getting Started\n- ::task:: Welcome! This is your first checklist. Go to the \"Create/Edit List\" tab to customize it."
          };

          $.jStorage.set(profilesKey, profiles);
          $.jStorage.set("current_profile", uniqueId);
          console.log("Created timestamped default profile after deletion:", uniqueId);
        }

        populateProfiles();
        generateTasks();

        // Hide both modals
        $("#confirmDeleteModal").modal("hide");
        $("#profileModal").modal("hide");

        // Show feedback
        showFeedback("Profile deleted successfully!");
      }
    });
  });

  // Checklist editing functionality

  // Save checklist button
  $("#save-checklist").on("click", function () {
    const checklistContent = $("#checklist-content").val();
    const currentProfile = getCurrentProfile();

    currentProfile.checklistContent = checklistContent;
    saveCurrentProfile(currentProfile);

    generateTasks();

    // Provide feedback to user
    showFeedback("Checklist saved successfully!");

    // Switch to the Checklist tab
    $('a[href="#tabPlaythrough"]').tab('show');
  });

  // Import button
  $("#import-checklist").on("click", function () {
    $("#file-input").click();
  });

  // Handle file selection for import
  $("#file-input").on("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.checklistContent) {
          $("#checklist-content").val(data.checklistContent);

          // Optionally import the checklist data (completed items)
          const currentProfile = getCurrentProfile();
          if (data.checklistData) {
            currentProfile.checklistData = data.checklistData;
          }
          currentProfile.checklistContent = data.checklistContent;
          saveCurrentProfile(currentProfile);

          generateTasks();

          // Provide feedback to user
          showFeedback("Checklist imported successfully!");

          // Switch to the Checklist tab
          $('a[href="#tabPlaythrough"]').tab('show');
        }
      } catch (error) {
        showFeedback("Invalid file format. Please select a valid checklist file.", "error");
      }
    };
    reader.readAsText(file);
  });

  // Export button
  $("#export-checklist").on("click", function () {
    const currentProfile = getCurrentProfile();
    const data = {
      checklistContent: currentProfile.checklistContent,
      checklistData: currentProfile.checklistData
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = (currentProfile.name || "checklist") + ".json";
    a.click();

    URL.revokeObjectURL(url);

    // Provide feedback to user
    showFeedback("Checklist exported successfully!");
  });

  // Initialize filter toggles

  // Toggle Hide Completed Items
  $("#toggleHideCompleted").on("change", function () {
    if ($(this).is(":checked")) {
      $("body").addClass("hide_completed");
    } else {
      $("body").removeClass("hide_completed");
    }
  });

  // Toggle Hide Item Types
  function setupItemTypeToggle(toggleId, classname) {
    $(toggleId).on("change", function () {
      if ($(this).is(":checked")) {
        $("body").addClass("hide_" + classname);
      } else {
        $("body").removeClass("hide_" + classname);
      }
    });
  }

  setupItemTypeToggle("#toggleHideUncommon", "uncommon");
  setupItemTypeToggle("#toggleHideStory", "story");

  // --- Share Modal Logic ---
  const MAX_URL_LENGTH = 2000; // Adjust as needed

  // When the Share modal is shown, prepare the share options
  $('#shareModal').on('show.bs.modal', function () {
    const currentProfile = getCurrentProfile();
    if (!currentProfile) {
      console.error("No current profile found for sharing.");
      // Optionally disable buttons or show an error in the modal
      $('#share-copy-url-btn').prop('disabled', true);
      $('#share-copy-code-btn').prop('disabled', true);
      return;
    }

    const dataToShare = {
      checklistContent: currentProfile.checklistContent || "",
      checklistData: currentProfile.checklistData || {}
    };

    const compressedData = compressData(dataToShare);

    if (!compressedData) {
      console.error("Compression failed.");
      $('#share-copy-url-btn').prop('disabled', true).tooltip('hide');
      $('#share-copy-code-btn').prop('disabled', true).tooltip('hide');
      $('#share-url-disabled-reason').text('(Compression error)').show();
      return;
    }

    const baseUrl = window.location.origin + window.location.pathname; // Base URL without hash/query
    const shareUrl = baseUrl + '#' + compressedData;
    const urlLength = shareUrl.length;

    // Configure URL Button
    // Always enable the button, but add a warning on click if too long
    $('#share-copy-url-btn').prop('disabled', false).off('click').on('click', async function () {
      const success = await copyToClipboard(shareUrl);
      if (success) {
        showCopyFeedback('copy-feedback', 'Link Copied!');
        // Also show a warning if the URL is too long
        if (urlLength >= MAX_URL_LENGTH) {
          showFeedback(`Warning: Link is very long (${urlLength} chars) and may not work everywhere.`, "error");
        }
      }
    }).tooltip('enable');
    // Remove the reason text display
    $('#share-url-disabled-reason').hide();

    // Configure Code Button
    $('#share-copy-code-btn').prop('disabled', false).off('click').on('click', async function () {
      const success = await copyToClipboard(compressedData);
      if (success) showCopyFeedback('copy-feedback', 'Code Copied!');
    }).tooltip('enable');

    // Clear import feedback and textarea
    $('#import-code-area').val('');
    $('#import-feedback').hide();
    $('#copy-feedback').hide(); // Hide copy feedback initially

  });

  // Initialize tooltips (needs to be done after elements are in the DOM)
  $(function () {
    $('[data-toggle="tooltip"]').tooltip();
  });


  // --- Import from Code Logic ---
  $('#import-load-code-btn').on('click', function () {
    const compressedCode = $('#import-code-area').val().trim();
    if (!compressedCode) {
      showImportFeedback("Please paste a code first.", "error");
      return;
    }

    const importedData = decompressData(compressedCode);

    if (importedData && importedData.checklistContent !== undefined && importedData.checklistData !== undefined) {
      // Success - Create new profile (similar to URL import)
      const profiles = $.jStorage.get(profilesKey, {});

      // Use the new function to get unique ID and name
      const { uniqueName, uniqueId } = generateUniqueProfileName("Imported", profiles);

      profiles[uniqueId] = {
        id: uniqueId,
        name: uniqueName, // Use the generated unique name
        checklistData: importedData.checklistData || {},
        checklistContent: importedData.checklistContent || "# Imported Checklist\\n- ::task:: Welcome!"
        // Note: No importHash needed for code import
      };

      $.jStorage.set(profilesKey, profiles);
      $.jStorage.set("current_profile", uniqueId); // Set current profile to the new unique ID

      // Refresh UI
      populateProfiles();
      generateTasks();
      showImportFeedback("Checklist imported successfully!", "success");
      $('#import-code-area').val(''); // Clear textarea
      // Optionally close modal: $('#shareModal').modal('hide');

    } else {
      // Failure
      showImportFeedback("Invalid or corrupt code.", "error");
    }
  });
}

function createTableOfContents() {
  const $toc = $(".table_of_contents");
  $toc.empty();

  $("h3[id]").each(function () {
    const $h3 = $(this);
    const id = $h3.attr("id");
    const text = $h3.find("a[href='#']").text();

    // Get item counts for the category
    const $items = $h3.next("ul").find("li[data-id]").not("li[data-id] li[data-id]");
    const total = $items.length;

    // Skip empty categories or those with invalid/empty text
    if (total === 0 || !text.trim()) {
      return;
    }

    const completed = $items.filter(".completed").length;

    // Create TOC item with count
    const $li = $("<li>");
    const $a = $("<a>").attr("href", "#" + id).text(text);
    const $count = $("<span>").addClass("toc-count").text(" (" + completed + "/" + total + ")");

    $li.append($a).append($count);
    $toc.append($li);
  });
}

// Feedback function
function showFeedback(message, type = "success") {
  // Create feedback element if it doesn't exist
  if (!$("#feedback-message").length) {
    $("body").append('<div id="feedback-message" class="alert"></div>');
  }

  const $feedback = $("#feedback-message");
  $feedback.removeClass("alert-success alert-danger").addClass(type === "success" ? "alert-success" : "alert-danger");
  $feedback.text(message);
  $feedback.fadeIn();

  // Hide after 3 seconds
  setTimeout(function () {
    $feedback.fadeOut();
  }, 3000);
}

// Function to process the URL hash for imported checklists
function processUrlHash() {
  const hash = window.location.hash.substring(1); // Get current hash, remove leading '#'

  if (!hash) {
    // No hash, nothing to do
    return;
  }

  console.log("Processing hash:", hash);

  // Check if this hash has already been imported
  const importedHashes = $.jStorage.get(importedHashesKey, []);
  if (importedHashes.includes(hash)) {
    console.log("Hash already imported:", hash);
    showFeedback("This checklist has already been imported.", "error");

    // Clean the URL hash anyway
    cleanUrlHash();
    return; // Stop processing
  }

  // Attempt to decompress and process the hash
  const importedData = decompressData(hash);

  if (importedData && importedData.checklistContent !== undefined && importedData.checklistData !== undefined) {
    console.log("Successfully decompressed data from hash:", importedData);
    const profiles = $.jStorage.get(profilesKey, {});

    // Use the new function to get unique ID and name
    const { uniqueName, uniqueId } = generateUniqueProfileName("Imported", profiles);

    profiles[uniqueId] = {
      id: uniqueId,
      name: uniqueName, // Use the generated unique name
      checklistData: importedData.checklistData || {},
      checklistContent: importedData.checklistContent || "# Imported Checklist\\n- ::task:: Welcome!",
      importHash: hash // Store the original hash
    };

    $.jStorage.set(profilesKey, profiles);
    $.jStorage.set("current_profile", uniqueId); // Set current profile to the new unique ID

    // Add the hash to the list of imported hashes and save it
    importedHashes.push(hash);
    $.jStorage.set(importedHashesKey, importedHashes);

    console.log("New profile created:", uniqueId, "Name:", uniqueName);

    // Clean the URL hash without reloading
    cleanUrlHash();

    // Refresh UI
    populateProfiles(); // Ensure this function selects the new profile
    generateTasks();    // Generate tasks for the new profile
    showFeedback("Checklist imported successfully from URL!", "success");

  } else {
    console.warn("Failed to decompress or validate data from hash.");
    // Clean the URL hash even if import failed
    cleanUrlHash();
    showFeedback("Could not import checklist from URL (invalid data).", "error");
  }
}

// Helper function to clean the hash from the URL
function cleanUrlHash() {
  if (history.replaceState) {
    // Use replaceState to clean the URL without adding to history or reloading
    history.replaceState(null, null, window.location.pathname + window.location.search);
    console.log("URL hash cleaned.");
  } else {
    // Fallback for older browsers (might cause a reload or jump)
    window.location.hash = '';
    console.warn("history.replaceState not supported, hash removal might be imperfect.");
  }
}

$(document).ready(function () {
  // Process the hash on initial page load
  processUrlHash();

  // Also process the hash whenever it changes (e.g., pasting a URL)
  $(window).on('hashchange', function () {
    console.log("Hash changed, processing...");
    processUrlHash();
  });

  // Initialize the rest of the page
  initializeProfileFunctionality($);
  generateTasks(); // Initial generation based on current/default profile

  // Back to top button
  $(window).scroll(function () {
    if ($(this).scrollTop() > 200) {
      $(".back-to-top").fadeIn();
    } else {
      $(".back-to-top").fadeOut();
    }
  });

  $(".back-to-top").click(function () {
    $("html, body").animate({ scrollTop: 0 }, 300);
    return false;
  });
});

// --- Tokenization Helpers ---

// Dictionary: Map tokens (short strings) to original long strings
const tokenDictionary = {
  "~T~": "::task::",
  "~M~": "::missable::",
  "~U~": "::item_uncommon::",
  "~S~": "::item_story::",
  "~L~": "https://",
  // Add more frequently used long strings or patterns here
};

// Precompute the reverse dictionary for faster detokenization
const reverseTokenDictionary = Object.fromEntries(
  Object.entries(tokenDictionary).map(([key, value]) => [value, key])
);

// Function to replace long strings with tokens in checklistContent
function tokenizeData(data) {
  if (!data || !data.checklistContent) return data;

  let tokenizedContent = data.checklistContent;
  // Iterate longer strings first to avoid partial replacements
  const sortedOriginals = Object.keys(reverseTokenDictionary).sort((a, b) => b.length - a.length);

  for (const original of sortedOriginals) {
    const token = reverseTokenDictionary[original];
    // Use a regex with the 'g' flag for global replacement
    // Escape special regex characters in the original string
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    tokenizedContent = tokenizedContent.replace(new RegExp(escapedOriginal, 'g'), token);
  }

  // Return a *new* object with the tokenized content
  return {
    ...data,
    checklistContent: tokenizedContent,
    // Note: We are not tokenizing checklistData keys for now, focusing on content size.
  };
}

// Function to replace tokens with original strings in checklistContent
function detokenizeData(data) {
  if (!data || !data.checklistContent) return data;

  let detokenizedContent = data.checklistContent;
  // Iterate tokens for replacement
  // No specific order needed here, but iterating the dictionary is fine
  for (const token in tokenDictionary) {
    const original = tokenDictionary[token];
    // Use a regex with the 'g' flag for global replacement
    // Escape special regex characters in the token
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    detokenizedContent = detokenizedContent.replace(new RegExp(escapedToken, 'g'), original);
  }

  // Return a *new* object with the detokenized content
  return {
    ...data,
    checklistContent: detokenizedContent,
  };
}


// --- LZString Compression/Decompression Helpers ---
function compressData(data) {
  try {
    // 1. Tokenize the data (specifically checklistContent for now)
    const tokenizedData = tokenizeData(data);
    // 2. Stringify the tokenized data
    const jsonString = JSON.stringify(tokenizedData);
    // 3. Compress the stringified tokenized data
    return LZString.compressToBase64(jsonString);
  } catch (error) {
    console.error("Error compressing data:", error);
    return null;
  }
}

function decompressData(compressedString) {
  try {
    if (!compressedString) return null;
    // 1. Decompress the string
    const jsonString = LZString.decompressFromBase64(compressedString);
    if (!jsonString) return null; // Decompression failed
    // 2. Parse the JSON string
    let parsedData = JSON.parse(jsonString);
    // 3. Detokenize the data (specifically checklistContent for now)
    return detokenizeData(parsedData);
  } catch (error) {
    // Catch errors from decompression, parsing, or detokenization
    console.error("Error decompressing data:", error);
    return null; // Also catches JSON parse errors or detokenization errors
  }
}

// Helper to show feedback in the modal
function showImportFeedback(message, type = "success") {
  const $feedback = $("#import-feedback");
  $feedback.text(message)
    .removeClass("text-success text-danger")
    .addClass(type === "success" ? "text-success" : "text-danger")
    .fadeIn();
  setTimeout(() => $feedback.fadeOut(), 3000);
}

// Helper to show feedback for copy actions
function showCopyFeedback(targetElementId, message = "Copied!") {
  const $feedback = $("#" + targetElementId);
  $feedback.text(message).fadeIn();
  setTimeout(() => $feedback.fadeOut(), 1500);
}

// Helper to copy text to clipboard
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("Failed to copy: ", err);
      return false;
    }
  } else {
    // Fallback for older browsers or non-secure contexts
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; // Prevent scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      console.error("Fallback copy failed: ", err);
      document.body.removeChild(textArea);
      return false;
    }
  }
}
