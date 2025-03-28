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

      // Convert markdown-style links to HTML links
      const linkPattern = /\[(.*?)\]\((.*?)\)/g;
      listItemText = listItemText.replace(
        linkPattern,
        '<a href="$2" target="_blank">$1</a>'
      );

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
    // If no current profile or the current profile doesn't exist, use the first one
    const firstProfileId = Object.keys(profiles)[0];
    if (firstProfileId) {
      $.jStorage.set("current_profile", firstProfileId);
      return profiles[firstProfileId];
    }

    // If no profiles exist, create a default one
    const defaultProfileId = "default";
    profiles[defaultProfileId] = {
      id: defaultProfileId,
      name: "Default",
      checklistData: {},
      checklistContent: "# Getting Started\n- ::task:: Welcome to the Custom Checklist Tool! Create your first checklist by going to the \"Create/Edit List\" tab."
    };

    $.jStorage.set(profilesKey, profiles);
    $.jStorage.set("current_profile", defaultProfileId);
    return profiles[defaultProfileId];
  }

  return profiles[profileId];
}

function saveCurrentProfile(profile) {
  const profiles = $.jStorage.get(profilesKey, {});
  profiles[profile.id] = profile;
  $.jStorage.set(profilesKey, profiles);
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

  // If no profiles exist, create a default one
  if (Object.keys(profiles).length === 0) {
    const defaultProfileId = "default";
    profiles[defaultProfileId] = {
      id: defaultProfileId,
      name: "Default",
      checklistData: {},
      checklistContent: "# Getting Started\n- ::task:: Welcome to the Custom Checklist Tool! Create your first checklist by going to the \"Create/Edit List\" tab."
    };

    $.jStorage.set(profilesKey, profiles);
    $.jStorage.set("current_profile", defaultProfileId);

    // Add the default profile to the select
    $select.append($("<option>").val(defaultProfileId).text("Default").prop("selected", true));
  }
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

    const profileId = sanitize(profileName) + "_" + Date.now();
    const profiles = $.jStorage.get(profilesKey, {});

    profiles[profileId] = {
      id: profileId,
      name: profileName,
      checklistData: {},
      checklistContent: "# Getting Started\n- ::task:: Welcome to the Custom Checklist Tool! Create your first checklist by going to the \"Create/Edit List\" tab."
    };

    $.jStorage.set(profilesKey, profiles);
    $.jStorage.set("current_profile", profileId);

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
    const currentProfileId = $.jStorage.get("current_profile", null);
    const profiles = $.jStorage.get(profilesKey, {});

    if (currentProfileId && profiles[currentProfileId]) {
      delete profiles[currentProfileId];
      $.jStorage.set(profilesKey, profiles);

      // Set current profile to the first available one
      const firstProfileId = Object.keys(profiles)[0];
      if (firstProfileId) {
        $.jStorage.set("current_profile", firstProfileId);
      } else {
        // If no profiles left, create a default one
        const defaultProfileId = "default";
        profiles[defaultProfileId] = {
          id: defaultProfileId,
          name: "Default",
          checklistData: {},
          checklistContent: "# Getting Started\n- ::task:: Welcome to the Custom Checklist Tool! Create your first checklist by going to the \"Create/Edit List\" tab."
        };

        $.jStorage.set(profilesKey, profiles);
        $.jStorage.set("current_profile", defaultProfileId);
      }

      populateProfiles();
      generateTasks();
      $("#profileModal").modal("hide");
    }
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

$(document).ready(function () {
  // Initialize the page
  initializeProfileFunctionality($);
  generateTasks();

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
