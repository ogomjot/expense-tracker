# Expense Tracker

## Project Goals

1. Track expenses and income
2. Input transactions with category and date
3. Calculate totals with respect to time frame chosen by user
4. Login system (future)
5. Backend integration (future)
6. Graph for expenses categorized (future)

## Current Features ✅

- Add income and expense transactions
- Categorize transactions (Food, Transport, Utilities, Entertainment, Salary, Other)
- **Create and manage custom categories** for expenses and income
- View transactions with date and category
- **Filter transactions by type and date range** (start date and end date)
- Calculate total income, total expenses, and balance
- **Pie charts for expense categories breakdown**
- **Pie charts for income categories breakdown**
- Category analysis with legend showing percentages
- **Monthly trends chart** showing income and expenses over time
- **Budget tracking** - Set budgets per category with progress visualization
- **Budget alerts** - Visual warnings when spending exceeds 80% or 100% of budget
- Delete transactions
- **Export transactions to CSV** file
- Local storage for data persistence
- Responsive design

## File Structure

```
expense-tracker/
├── index.html      # Main HTML file
├── main.css        # Styling
├── app.js          # Core application logic
└── project.md      # Project documentation
```

## How to Use

1. Open `index.html` in a web browser

2. **Add Custom Categories (Optional):**
   - Go to "Manage Categories" section
   - Enter a category name
   - Select whether it's for Expenses or Income
   - Click "Add Category"
   - Remove categories by clicking the × button on them

3. **Fill in the form to add a transaction:**
   - Choose type (Expense or Income)
   - Select a category (or use custom categories you created)
   - Enter description
   - Enter amount
   - Select date
   - Click "Add Transaction"

4. **View category analysis in pie charts:**
   - See expense breakdown by category
   - See income breakdown by category
   - Charts show amounts and percentages

5. **Track Monthly Trends:**
   - View a line chart showing income and expenses for each month
   - Helps identify spending patterns over time

6. **Set Budgets:**
   - Go to "Budget Tracker" section
   - Select a category
   - Enter budget amount
   - Click "Set Budget"
   - See progress bars showing spending vs. budget
   - Yellow bar = warning (spending >80% of budget)
   - Red bar = exceeded budget
   - Delete budgets by clicking the "Delete" button

7. **Filter Transactions:**
   - Filter by type (All Types, Expenses, or Income)
   - Use "From" and "To" date fields for custom date ranges
   - Click "Reset" to clear all filters

8. **Export Data:**
   - Click "Export CSV" to download filtered transactions as a CSV file
   - Can be opened in Excel or Google Sheets

9. **View and Delete:**
   - See all transactions below the charts
   - Click "Delete" to remove a transaction

## Technology Stack

- HTML5
- CSS3 (with Flexbox and Grid)
- Vanilla JavaScript (ES6+)
- LocalStorage API for data persistence
- Chart.js for pie and line chart visualization

## Future Enhancements

- User authentication/login system
- Backend API integration (Node.js/Express)
- Database for persistent storage
- Recurring expense tracking
- Multiple wallets/accounts
- Export data to PDF
- Mobile app version
- Push notifications for budget alerts
- Advanced analytics and reports
