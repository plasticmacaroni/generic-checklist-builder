# Custom Checklist Tool

A customizable checklist tool that allows you to create and manage your own checklists. You can create categories, add items, and track your progress.

## Features

- Create custom checklists with categories and items
- Check off items as you complete them
- Track progress with completion statistics
- Filter items by type
- Multiple checklist profiles
- Import/Export functionality
- Mobile-friendly design
- Add links to your checklist items

## How to Use

1. **Create a New Checklist**

   - Go to the "Create/Edit List" tab
   - Enter your checklist content following the format below
   - Click "Save Checklist" to save your changes

2. **View and Use Your Checklist**

   - Go to the "Checklist" tab
   - Check off items as you complete them
   - Use filters to show/hide different types of items
   - Use the "Hide Completed" option to focus on remaining items

3. **Manage Multiple Checklists**

   - Use the profile selector at the top right to switch between checklists
   - Click "Add" to create a new profile
   - Click "Edit" to rename or delete a profile

4. **Import/Export**
   - Use the "Export to File" button to save your checklist to a file
   - Use the "Import from File" button to load a checklist from a file

## Checklist Format

Use the following format to create your checklist:

```
# Category Name
- Item text
  - Sub-item text
- Another item
```

You can use prefixes to specify item types:

- `::task::` - Regular task
- `::missable::` - Urgent task
- `::item_uncommon::` - Special item
- `::item_story::` - Important note

### Adding Links

You can add links to your checklist items using markdown format:

```
- ::task:: Check the [project documentation](https://example.com/docs)
```

This will render as a clickable link that opens in a new tab.

## Example

```
# Shopping List
- ::task:: Buy groceries
  - ::task:: Milk
  - ::task:: Eggs
  - ::missable:: Fresh bread (expires soon!)
# Work Tasks
- ::task:: Complete project report
- ::missable:: Submit timesheet by Friday
- ::task:: Review [company guidelines](https://example.com/guidelines)
```

## Schema for AI-Generated Checklists

If you're using an AI tool to generate a checklist, you can provide this schema description:

```
Create a checklist using this format:
1. Categories are denoted with "# Category Name"
2. Items are listed with "- " prefix
3. Sub-items are indented with two spaces before the "- " prefix
4. Each item should have a type prefix:
   - ::task:: for regular tasks
   - ::missable:: for urgent/time-sensitive tasks
   - ::item_uncommon:: for special items
   - ::item_story:: for important notes
5. Links can be added using markdown format: [Link text](https://example.com)

Example:
# Shopping List
- ::task:: Buy groceries
  - ::task:: Milk
  - ::task:: Eggs
  - ::missable:: Fresh bread (expires soon!)
# Work Tasks
- ::task:: Complete project report
- ::missable:: Submit timesheet by Friday
- ::task:: Check [company policy](https://example.com/policy)

Convert the following list into a properly formatted checklist:
[YOUR LIST HERE]
```

## Storage

Your checklists are saved in your browser's local storage. They will persist across browser sessions, but clearing your browser data will remove them. Use the Export/Import feature to back up your checklists.

## Browser Compatibility

This tool works best in modern browsers such as:

- Chrome
- Firefox
- Edge
- Safari
