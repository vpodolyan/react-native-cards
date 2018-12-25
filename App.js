import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import CardsBox from './CardsBox';

export default class App extends React.Component {
  render() {
    return <CardsBox />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
