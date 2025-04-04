// static/js/react/App.jsx
function App() {
  const [title, setTitle] = React.useState("CRAPP: Cognitive Reporting Application");
  
  return (
    <AuthProvider>
      <NotificationProvider>
        <div className="app">
          <Head title={title} />
          <div className="container">
            <Header />
            <Message />
            <Router setTitle={setTitle} />
            <Footer />
          </div>
        </div>
      </NotificationProvider>
    </AuthProvider>
  );
}