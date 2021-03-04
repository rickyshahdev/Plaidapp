import React, { Component } from "react";
import PropTypes from "prop-types";
import PlaidLinkButton from "react-plaid-link-button";
import { connect } from "react-redux";
import axios from "axios";
import Spinner from "./Spinner";
import {
  getTransactions,
  addAccount,
  deleteAccount
} from "../../actions/accountActions";
import { logoutUser } from "../../actions/authActions";
import MaterialTable from "material-table"; // https://mbrn.github.io/material-table/#/
class Accounts extends Component {
  constructor(props) {
    super(props);

    this.state = {
      plaidLinkToken: null,
      loadingLinkToken: true
    }
  }
  componentDidMount() {
    const { accounts } = this.props;
    this.props.getTransactions(accounts);
    axios
      .post("http://localhost:5000/api/plaid/api/create_link_token")
      .then(this.setLinkToken)
      .catch(err => console.log(err));
  }
  setLinkToken = response => {
    const { data, status } = response;
    if(status === 200) {
      this.setState({ plaidLinkToken: data.link_token, loadingLinkToken: false })
    } else {
      // error
      console.error(response)
    }
  }

// Add account

 handleOnSuccess = (token, metadata) => {
    const { accounts } =  this.props;

const plaidData =  {
      public_token: token,
      metadata: metadata,
      accounts: accounts,

    };
    // send public_token to server
this.props.addAccount(plaidData);
};
// Delete account
  onDeleteClick = id => {
    const { accounts } = this.props;
    const accountData = {
      id: id,
      accounts: accounts
    };
    this.props.deleteAccount(accountData);
  };
// Logout
  onLogoutClick = e => {
    e.preventDefault();
    this.props.logoutUser();
  };

render = () => {
    const { user, accounts } = this.props;
    const { transactions, transactionsLoading } = this.props.plaid;
let accountItems = accounts.map(account => (
      <li key={account._id} style={{ marginTop: "1rem" }}>
        <button
          style={{ marginRight: "1rem" }}
          onClick={this.onDeleteClick.bind(this, account._id)}
          className="btn btn-small btn-floating waves-effect waves-light hoverable red accent-3"
        >
          <i className="material-icons">delete</i>
        </button>
        <b>{account.institutionName}</b>
      </li>
    ));
// Setting up data table
    const transactionsColumns = [
      { title: "Account", field: "account" },
      { title: "Date", field: "date", type: "date", defaultSort: "desc" },
      { title: "Name", field: "name" },
      { title: "Amount", field: "amount" },
      { title: "Category", field: "category" }
    ];
let transactionsData = [];
    transactions.forEach(function(account) {
      account.transactions.forEach(function(transaction) {
         transactionsData.push({
          account: account.accountName,
          date: transaction.date,
          category: transaction.category[0],
          name: transaction.name,
          amount: transaction.amount
        });
      });
    });
    let accountContent;
  if(transactionsData === null || transactionsLoading || this.state.loadingLinkToken){
    transactionsData = <Spinner />;
    transactionsData = <p className="center-align">Loading...</p>;
  }else {
 accountContent = (
      <div className="row">
        <div className="col s12">
          <button
            onClick={this.onLogoutClick}
            className="btn-flat waves-effect"
          >
            <i className="material-icons left">keyboard_backspace</i> Log Out
          </button>

{/* ========== Carole deleted/added =========== */}
{/*
          <h4>
            <b>Welcome!</b>
          </h4>
          <p className="grey-text text-darken-1">
            Hey there, {user.name.split(" ")[0]}
          </p>
*/}

        <div className="bankTitle">
          United Bank
        </div>

          <h5 className="linkedAccounts">
            <b>Linked Accounts</b>
          </h5>

{/*
          <p className="grey-text text-darken-1">
            Add or remove your bank accounts below
          </p>
*/}
          <div className="accountSection">
            <ul>{accountItems}</ul>
            <ul className="balanceButtons">
              <button className="balance"> Current Balance </button>
              <button className="balance"> Current Balance </button>
            </ul>
          </div>
{/* =============  End Carole added =========== */}

          <PlaidLinkButton
            buttonProps={{
              className:
                "btn btn-large waves-effect waves-light hoverable blue accent-3 main-btn"
            }}
            plaidLinkProps={{
              clientName: "BankConnector",
              key:" ",
              token: this.state.plaidLinkToken,
              env: "sandbox",
              product: ["transactions"],
              onSuccess: this.handleOnSuccess

            }}

          >
            Add Account
          </PlaidLinkButton>
          <hr style={{ marginTop: "2rem", opacity: ".2" }} />
          <h5>
            <b>Transactions</b>
          </h5>
          {transactionsLoading ? (
            <p className="grey-text text-darken-1">Fetching transactions...</p>
          ) : (
            <>
              <p className="grey-text text-darken-1">
                You have <b>{transactionsData.length}</b> transactions from your
                <b> {accounts.length}</b> linked
                {accounts.length > 1 ? (
                  <span> accounts </span>
                ) : (
                  <span> account </span>
                )}
                from the past 12 months
              </p>
              <MaterialTable
                columns={transactionsColumns}
                data={transactionsData}
                title="Search Transactions"
              />
            </>
          )}
        </div>
      </div>
      );
    }
    return <div className="container">{accountContent}</div>;
  }
}
Accounts.propTypes = {
  logoutUser: PropTypes.func.isRequired,
  getTransactions: PropTypes.func.isRequired,
  addAccount: PropTypes.func.isRequired,
  deleteAccount: PropTypes.func.isRequired,
  accounts: PropTypes.array.isRequired,
  plaid: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired
};
const mapStateToProps = state => ({
  plaid: state.plaid
});
export default connect(
  mapStateToProps,
  { logoutUser, getTransactions, addAccount, deleteAccount }
)(Accounts);
