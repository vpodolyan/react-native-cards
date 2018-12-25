import React, { Component } from 'react';
import { StyleSheet, View } from 'react-native';
import SwipeableCard from './SwipeableCard/SwipeableCard';

export default class CardsBox extends Component {
    state = {
        cards: [1, 2, 3, 4]
    }

    cardSnapPoints = [{ x: 1 }, { x: 0, damping: 0.5 }, { x: -1 }];

    getBackgroundColor = (id) => {
        switch (id) {
            case 1: return 'red';
            case 2: return 'blue';
            case 3: return 'yellow';
            case 4: return 'green';
        }
    }

    handleOnSpan = ({ nativeEvent: { index } }) => {
        if (index === 0) {
            this.setState({
                cards: [
                    this.state.cards[3],
                    ...this.state.cards.filter(itemId => itemId !== this.state.cards[3]),
                ]
            })
        } else if (index === 2) {
            this.setState({
                cards: [
                    ...this.state.cards.filter(itemId => itemId !== this.state.cards[0]),
                    this.state.cards[0],
                ]
            })
        }
    }

    render() {
        return (
            <View style={styles.container}>
                {
                    this.state.cards.map((id) => {
                        return (
                            <SwipeableCard
                                onSnap={this.handleOnSpan}
                                style={styles.card}
                                key={id}
                                horizontalOnly={true}
                                snapPoints={this.cardSnapPoints}>
                                <View style={[styles.cardContent, { backgroundColor: this.getBackgroundColor(id) }]} />
                            </SwipeableCard>
                        );
                    })
                }
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
    },
    card: {
        position: 'absolute',
    },
    cardContent: {
        width: 280,
        height: 400,
        borderRadius: 8,
        marginVertical: 6,
    },
});
